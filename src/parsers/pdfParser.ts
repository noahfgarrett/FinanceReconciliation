import { pdfjs } from './pdfjsConfig'
import type { ParsedPdf, PdfTimesheetEntry, RowFlag } from '@/persistence/schemas'
import { isoMonday } from '@/lib/dateUtils'

export interface PdfParseResult {
  parsed: ParsedPdf | null
  warnings: RowFlag[]
}

interface TextItem {
  str: string
  x: number
  y: number
  pageIndex: number
}

interface TextLine {
  items: TextItem[]
  y: number
  pageIndex: number
}

// ---- Regex patterns ----

// "Employee: Noah Garrett 2000" or "Employee:Noah Garrett 2000"
const HEADER_RE =
  /Employee:?\s+([A-Z][A-Za-z'\\-]+(?:\s+[A-Z][A-Za-z'\\-]+)+)\s+(\d{4})\b/

// Fallback: more lenient, handles line-breaks that get squished
const HEADER_FALLBACK_RE = /Employee:?\s*([A-Za-z' -]+?)\s+(\d{3,5})\b/

// Date range in header: "04/06/2026 - 04/19/2026", "Period: ...", etc.
const PERIOD_RES: RegExp[] = [
  /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:[-–—]|to)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  /Period:?\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–—]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
]

// Date token: 1/1/2026 or 01/01/26
const DATE_TOKEN_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/

// Hours token: number 0.1–24, optionally decimals. Catches "8", "8.0", "7.50"
const HOURS_RE = /^\d{1,2}(?:\.\d{1,3})?$/

// Allocation code: uppercase letters/digits with at least one separator (-, _, ., /)
// This distinguishes project codes like "ACM-001" from pay codes like "REG"
const ALLOC_RE = /^[A-Z0-9]+[-_.][A-Z0-9][-A-Z0-9_.]*$/

// Weekly total markers
const TOTAL_LINE_RE = /(?:weekly\s+)?total/i

// ---- Helpers ----

function mmddyyyyToIso(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return ''
  const [, mm, dd, rawY] = m
  let yyyy = rawY
  if (yyyy.length === 2) yyyy = (parseInt(yyyy) > 50 ? '19' : '20') + yyyy
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function isLikelyDate(s: string): boolean {
  return DATE_TOKEN_RE.test(s)
}

function isLikelyCurrency(s: string): boolean {
  return /^\$[\d,]+/.test(s) || /^\d[\d,]+\.\d{2}$/.test(s)
}

function isAllocCode(token: string): boolean {
  if (!ALLOC_RE.test(token)) return false
  if (isLikelyDate(token)) return false
  if (isLikelyCurrency(token)) return false
  // exclude pure year-like 4-digit tokens
  if (/^\d{4}$/.test(token)) return false
  return true
}

/** Group text items (same page, y within 1pt) into lines, sorted top-down, left-right. */
function groupIntoLines(items: TextItem[]): TextLine[] {
  const lineMap = new Map<string, TextItem[]>()

  for (const item of items) {
    // Key by page + rounded y (1pt tolerance via Math.round)
    const key = `${item.pageIndex}:${Math.round(item.y)}`
    const existing = lineMap.get(key)
    if (existing) {
      existing.push(item)
    } else {
      lineMap.set(key, [item])
    }
  }

  const lines: TextLine[] = []
  for (const [key, lineItems] of lineMap.entries()) {
    const [pageStr, yStr] = key.split(':')
    lineItems.sort((a, b) => a.x - b.x)
    lines.push({ items: lineItems, y: parseFloat(yStr), pageIndex: parseInt(pageStr) })
  }

  // Sort top-down per page (higher y = higher on page in PDF coords)
  lines.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex
    return b.y - a.y // higher y value = closer to top in PDF space
  })

  return lines
}

/** Extract all text items from a PDF document buffer. */
async function extractTextItems(buffer: ArrayBuffer): Promise<TextItem[]> {
  const doc = await pdfjs.getDocument({ data: buffer }).promise
  const items: TextItem[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    for (const it of tc.items as Array<{ str: string; transform: number[] }>) {
      if (!it.str) continue
      items.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        pageIndex: p,
      })
    }
  }
  return items
}

/** Find employee name + code from raw text. Returns null if not found. */
function findEmployeeHeader(rawText: string): { name: string; code: string } | null {
  const m1 = HEADER_RE.exec(rawText)
  if (m1) return { name: m1[1].trim(), code: m1[2] }

  const m2 = HEADER_FALLBACK_RE.exec(rawText)
  if (m2) {
    const name = m2[1].trim()
    // Only accept if it looks like a real name (at least one space)
    if (name.includes(' ')) return { name, code: m2[2] }
  }
  return null
}

/** Find pay period start/end ISO dates from raw text. */
function findPayPeriod(rawText: string): { start: string; end: string } | null {
  for (const re of PERIOD_RES) {
    const m = re.exec(rawText)
    if (m) {
      const start = mmddyyyyToIso(m[1])
      const end = mmddyyyyToIso(m[2])
      if (start && end) return { start, end }
    }
  }
  return null
}

interface ParsedLine {
  tokens: string[]
  rawText: string
}

function lineToParsed(line: TextLine): ParsedLine {
  const tokens = line.items
    .map((i) => i.str.trim())
    .filter(Boolean)
    .join(' ')
    .split(/\s+/)
  return { tokens, rawText: tokens.join(' ') }
}

/** Extract timesheet entries from lines. */
function extractEntries(lines: TextLine[]): PdfTimesheetEntry[] {
  const entries: PdfTimesheetEntry[] = []

  for (const line of lines) {
    const { tokens } = lineToParsed(line)
    if (tokens.length < 3) continue

    // Find date token
    const dateToken = tokens.find((t) => isLikelyDate(t))
    if (!dateToken) continue

    // Find allocation code token (not a date, not currency, uppercase pattern)
    const allocToken = tokens.find((t) => isAllocCode(t))
    if (!allocToken) continue

    // Find hours: look for ALL plausible hours tokens (0.1–24), pick the LAST one
    // (Paycom puts day total at end of row)
    const hoursTokens = tokens.filter((t) => {
      if (!HOURS_RE.test(t)) return false
      const n = parseFloat(t)
      return n >= 0.1 && n <= 24
    })
    if (hoursTokens.length === 0) continue

    const hoursStr = hoursTokens[hoursTokens.length - 1]
    const hoursTotal = parseFloat(hoursStr)

    // Find pay code: short uppercase word, not alloc, not date token digits
    const payCodeToken =
      tokens.find((t) => {
        if (t === allocToken || isLikelyDate(t)) return false
        if (HOURS_RE.test(t)) return false
        return /^[A-Z]{2,6}$/.test(t)
      }) ?? 'REG'

    const dateIso = mmddyyyyToIso(dateToken)
    if (!dateIso) continue

    entries.push({
      date: dateIso,
      payCode: payCodeToken,
      allocation: allocToken,
      hoursTotal,
      weekStart: isoMonday(dateIso),
      confidence: 1,
      confidenceReasons: [],
    })
  }

  return entries
}

/** Aggregate entries by weekStart. */
function buildWeeklyTotals(entries: PdfTimesheetEntry[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const e of entries) {
    totals[e.weekStart] = (totals[e.weekStart] ?? 0) + e.hoursTotal
  }
  // Round to 2 decimal places
  for (const k of Object.keys(totals)) {
    totals[k] = Math.round(totals[k] * 100) / 100
  }
  return totals
}

/**
 * Cross-validate our aggregated weekly totals against any explicit "Total" lines found.
 * Emits info warnings if divergence found.
 */
function crossValidateTotals(
  lines: TextLine[],
  derived: Record<string, number>,
): RowFlag[] {
  const warnings: RowFlag[] = []
  // Find total lines with a numeric value at the end
  for (const line of lines) {
    const { rawText } = lineToParsed(line)
    if (!TOTAL_LINE_RE.test(rawText)) continue

    // Extract the last number from the line
    const numMatch = rawText.match(/(\d+(?:\.\d+)?)\s*$/)
    if (!numMatch) continue

    const explicitTotal = parseFloat(numMatch[1])
    // Sum our derived totals
    const derivedSum = Object.values(derived).reduce((acc, v) => acc + v, 0)

    if (Math.abs(explicitTotal - derivedSum) > 0.5) {
      warnings.push({
        severity: 'info',
        code: 'parse-failure',
        message: `Derived weekly hours sum (${derivedSum.toFixed(2)}) diverges from explicit total line (${explicitTotal}) by more than 0.5 hrs. Parser's aggregated value is used.`,
        context: { explicitTotal, derivedSum },
      })
    }
  }
  return warnings
}

/** Infer pay period from min/max entry dates. */
function inferPeriodFromEntries(entries: PdfTimesheetEntry[]): { start: string; end: string } | null {
  if (entries.length === 0) return null
  const dates = entries.map((e) => e.date).sort()
  return { start: dates[0], end: dates[dates.length - 1] }
}

export async function parsePdf(buffer: ArrayBuffer, fileName?: string): Promise<PdfParseResult> {
  const warnings: RowFlag[] = []
  // fileName is used in error context for diagnostics
  const fileLabel = fileName ?? 'unknown.pdf'

  let items: TextItem[]
  try {
    items = await extractTextItems(buffer)
  } catch (err) {
    return {
      parsed: null,
      warnings: [
        {
          severity: 'error',
          code: 'parse-failure',
          message: `Failed to read PDF "${fileLabel}": ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    }
  }

  const lines = groupIntoLines(items)
  const rawText = items.map((i) => i.str).join(' ')

  // 1. Find employee header
  const empHeader = findEmployeeHeader(rawText)
  if (!empHeader) {
    return {
      parsed: null,
      warnings: [
        {
          severity: 'error',
          code: 'parse-failure',
          message:
            `Could not find employee header in "${fileLabel}". Expected text like "Employee: First Last 1234" near the top.`,
        },
      ],
    }
  }

  // 2. Find pay period
  let periodStart: string
  let periodEnd: string
  const period = findPayPeriod(rawText)

  // 3. Extract entries
  const entries = extractEntries(lines)

  if (!period) {
    // Infer from entries
    const inferred = inferPeriodFromEntries(entries)
    if (inferred) {
      periodStart = inferred.start
      periodEnd = inferred.end
      warnings.push({
        severity: 'info',
        code: 'parse-failure',
        message: 'Pay period not found in PDF header; inferred from entry date range.',
      })
    } else {
      periodStart = ''
      periodEnd = ''
      warnings.push({
        severity: 'warn',
        code: 'parse-failure',
        message: 'Pay period date range not found in PDF.',
      })
    }
  } else {
    periodStart = period.start
    periodEnd = period.end
  }

  if (entries.length === 0) {
    warnings.push({
      severity: 'warn',
      code: 'parse-failure',
      message:
        'No timesheet entries found in PDF. The layout may have changed or the file may not be a Paycom timesheet.',
    })
    return { parsed: null, warnings }
  }

  // 4. Aggregate weekly totals
  const weeklyTotals = buildWeeklyTotals(entries)

  // 5. Cross-validate
  const validationWarnings = crossValidateTotals(lines, weeklyTotals)
  warnings.push(...validationWarnings)

  const parsed: ParsedPdf = {
    employeeCode: empHeader.code,
    employeeName: empHeader.name,
    payPeriodStart: periodStart,
    payPeriodEnd: periodEnd,
    entries,
    weeklyTotals,
    rawText,
    pageCount: 0,
  }

  return { parsed, warnings }
}

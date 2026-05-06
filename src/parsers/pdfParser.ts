import { pdfjs } from './pdfjsConfig'
import type {
  ParsedPdf, PdfTimesheetEntry, RowFlag, SourceLocation,
} from '@/persistence/schemas'
import { isoMonday } from '@/lib/dateUtils'

export interface PdfParseResult {
  parsed: ParsedPdf | null
  warnings: RowFlag[]
  /** Original PDF bytes (clone of the input buffer) for offline source viewing. */
  pdfBytes: ArrayBuffer | null
}

interface TextItem {
  str: string
  x: number
  y: number
  width: number
  height: number
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

// 2-digit-year date token (used for confidence scoring)
const DATE_2DIGIT_YEAR_RE = /^\d{1,2}\/\d{1,2}\/\d{2}$/

// Hours token: number 0.1–24, optionally decimals. Catches "8", "8.0", "7.50"
const HOURS_RE = /^\d{1,2}(?:\.\d{1,3})?$/

// Allocation code: uppercase letters/digits with at least one separator (-, _, ., /)
// This distinguishes project codes like "ACM-001" from pay codes like "REG"
const ALLOC_RE = /^[A-Z0-9]+[-_.][A-Z0-9][-A-Z0-9_.]*$/

// "Bare" allocation candidate: short uppercase token like REG-style (no separators)
// — only flagged for ambiguity, not used as an allocation
const ALLOC_BARE_RE = /^[A-Z]{3,8}$/

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
  // exclude plain decimal numbers (e.g. "8.0") that incidentally match the
  // separator-based alloc pattern
  if (/^\d+(\.\d+)?$/.test(token)) return false
  return true
}

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return Math.round(n * 100) / 100
}

/** Group text items (same page, y within 1pt) into lines, sorted top-down, left-right. */
function groupIntoLines(items: TextItem[]): TextLine[] {
  const lineMap = new Map<string, TextItem[]>()

  for (const item of items) {
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
    return b.y - a.y
  })

  return lines
}

/** Extract all text items + page count from a PDF document buffer. */
async function extractTextItems(
  buffer: ArrayBuffer,
): Promise<{ items: TextItem[]; pageCount: number }> {
  const doc = await pdfjs.getDocument({ data: buffer }).promise
  const items: TextItem[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    for (const it of tc.items as Array<{
      str: string
      transform: number[]
      width?: number
      height?: number
    }>) {
      if (!it.str) continue
      // Use provided width if available, else estimate from x-scale × char count.
      const width = typeof it.width === 'number' && it.width > 0
        ? it.width
        : Math.abs(it.transform[0]) * Math.max(1, it.str.length) * 0.5
      // Use provided height if available, else fall back to y-scale (transform[3]).
      const height = typeof it.height === 'number' && it.height > 0
        ? it.height
        : Math.abs(it.transform[3])
      items.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width,
        height,
        pageIndex: p,
      })
    }
  }
  return { items, pageCount: doc.numPages }
}

/** Find employee name + code from raw text. */
function findEmployeeHeader(rawText: string): {
  name: string
  code: string
  fallback: boolean
} | null {
  const m1 = HEADER_RE.exec(rawText)
  if (m1) return { name: m1[1].trim(), code: m1[2], fallback: false }

  const m2 = HEADER_FALLBACK_RE.exec(rawText)
  if (m2) {
    const name = m2[1].trim()
    if (name.includes(' ')) return { name, code: m2[2], fallback: true }
  }
  return null
}

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

/** Compute bounding box of given items in PDF point space. */
function bboxOfItems(items: TextItem[]): SourceLocation | null {
  if (items.length === 0) return null
  const pageIndex = items[0].pageIndex
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const it of items) {
    // PDF transform[5] is the BASELINE y; the glyph extends from (y) downward
    // for descenders and (y + height) upward. Use [y, y+height] as the y-range.
    const top = it.y + it.height
    const bottom = it.y
    minX = Math.min(minX, it.x)
    maxX = Math.max(maxX, it.x + it.width)
    minY = Math.min(minY, bottom)
    maxY = Math.max(maxY, top)
  }
  return {
    pageIndex,
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  }
}

/** Find which TextItems contributed to the given tokens on a line. */
function itemsForTokens(line: TextLine, tokens: string[]): TextItem[] {
  const wanted = new Set(tokens)
  return line.items.filter((it) => wanted.has(it.str.trim()))
}

interface EntryExtractionResult {
  entries: PdfTimesheetEntry[]
}

/** Extract timesheet entries with confidence + source bbox per entry. */
function extractEntries(lines: TextLine[]): EntryExtractionResult {
  const entries: PdfTimesheetEntry[] = []

  for (const line of lines) {
    const { tokens } = lineToParsed(line)
    if (tokens.length < 3) continue

    const dateToken = tokens.find((t) => isLikelyDate(t))
    if (!dateToken) continue

    // Find the canonical allocation token (separator-bearing)
    const allocCandidates = tokens.filter((t) => isAllocCode(t))
    const allocToken = allocCandidates[0]

    // Bare candidates that look like project/pay codes without a separator
    const bareCandidates = tokens.filter(
      (t) => ALLOC_BARE_RE.test(t) && t !== 'REG' && t !== 'OT' && t !== 'DT',
    )

    if (!allocToken && bareCandidates.length === 0) continue

    const hoursTokens = tokens.filter((t) => {
      if (!HOURS_RE.test(t)) return false
      const n = parseFloat(t)
      return n >= 0.1 && n <= 24
    })
    if (hoursTokens.length === 0) continue

    const hoursStr = hoursTokens[hoursTokens.length - 1]
    const hoursTotal = parseFloat(hoursStr)

    const finalAlloc = allocToken ?? bareCandidates[0]

    const payCodeToken =
      tokens.find((t) => {
        if (t === finalAlloc || isLikelyDate(t)) return false
        if (HOURS_RE.test(t)) return false
        return /^[A-Z]{2,6}$/.test(t)
      }) ?? 'REG'

    const dateIso = mmddyyyyToIso(dateToken)
    if (!dateIso) continue

    // ---- Confidence scoring ----
    let confidence = 1.0
    const reasons: string[] = []

    if (DATE_2DIGIT_YEAR_RE.test(dateToken)) {
      confidence -= 0.10
      reasons.push('ambiguous 2-digit year')
    }
    if (!allocToken && bareCandidates.length > 0) {
      confidence -= 0.15
      reasons.push('allocation looks like a pay code')
    }
    if (hoursTokens.length === 1) {
      confidence -= 0.05
    }
    if (hoursTotal < 0.5 || hoursTotal > 16) {
      confidence -= 0.20
      reasons.push('hours outside typical 0.5–16 range')
    }
    if (allocCandidates.length > 1) {
      confidence -= 0.10
      reasons.push('multiple allocation candidates on same line')
    }

    confidence = clamp01(confidence)

    // ---- Source bbox ----
    const tokensForBbox = [dateToken, finalAlloc, hoursStr]
    if (payCodeToken && tokens.includes(payCodeToken)) tokensForBbox.push(payCodeToken)
    const contributingItems = itemsForTokens(line, tokensForBbox)
    const source = bboxOfItems(contributingItems) ?? undefined

    entries.push({
      date: dateIso,
      payCode: payCodeToken,
      allocation: finalAlloc,
      hoursTotal,
      weekStart: isoMonday(dateIso),
      confidence,
      confidenceReasons: reasons,
      source,
    })
  }

  return { entries }
}

function buildWeeklyTotals(entries: PdfTimesheetEntry[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const e of entries) {
    totals[e.weekStart] = (totals[e.weekStart] ?? 0) + e.hoursTotal
  }
  for (const k of Object.keys(totals)) {
    totals[k] = Math.round(totals[k] * 100) / 100
  }
  return totals
}

function crossValidateTotals(
  lines: TextLine[],
  derived: Record<string, number>,
): RowFlag[] {
  const warnings: RowFlag[] = []
  for (const line of lines) {
    const { rawText } = lineToParsed(line)
    if (!TOTAL_LINE_RE.test(rawText)) continue

    const numMatch = rawText.match(/(\d+(?:\.\d+)?)\s*$/)
    if (!numMatch) continue

    const explicitTotal = parseFloat(numMatch[1])
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

function inferPeriodFromEntries(entries: PdfTimesheetEntry[]): { start: string; end: string } | null {
  if (entries.length === 0) return null
  const dates = entries.map((e) => e.date).sort()
  return { start: dates[0], end: dates[dates.length - 1] }
}

export async function parsePdf(buffer: ArrayBuffer, fileName?: string): Promise<PdfParseResult> {
  const warnings: RowFlag[] = []
  const fileLabel = fileName ?? 'unknown.pdf'

  // Clone the buffer first — pdfjs will neuter the original.
  // This clone is what we return for offline source viewing.
  const bytesForStorage = buffer.slice(0)
  // pdfjs gets its own copy as well so the storage clone stays intact.
  const pdfjsBuffer = buffer.slice(0)

  let extractRes: { items: TextItem[]; pageCount: number }
  try {
    extractRes = await extractTextItems(pdfjsBuffer)
  } catch (err) {
    return {
      parsed: null,
      pdfBytes: null,
      warnings: [
        {
          severity: 'error',
          code: 'parse-failure',
          message: `Failed to read PDF "${fileLabel}": ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    }
  }

  const { items, pageCount } = extractRes
  const lines = groupIntoLines(items)
  const rawText = items.map((i) => i.str).join(' ')

  const empHeader = findEmployeeHeader(rawText)
  if (!empHeader) {
    return {
      parsed: null,
      pdfBytes: bytesForStorage,
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

  if (empHeader.fallback) {
    warnings.push({
      severity: 'info',
      code: 'parse-failure',
      message: `Employee header in "${fileLabel}" matched via fallback regex; double-check parsed name/code.`,
    })
  }

  let periodStart: string
  let periodEnd: string
  const period = findPayPeriod(rawText)

  const { entries } = extractEntries(lines)

  if (!period) {
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
    return { parsed: null, pdfBytes: bytesForStorage, warnings }
  }

  const weeklyTotals = buildWeeklyTotals(entries)
  warnings.push(...crossValidateTotals(lines, weeklyTotals))

  const parsed: ParsedPdf = {
    employeeCode: empHeader.code,
    employeeName: empHeader.name,
    payPeriodStart: periodStart,
    payPeriodEnd: periodEnd,
    entries,
    weeklyTotals,
    rawText,
    pageCount,
  }

  return { parsed, pdfBytes: bytesForStorage, warnings }
}

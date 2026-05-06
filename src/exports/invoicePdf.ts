import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Client, ProjectConfig, Snapshot } from '@/persistence/schemas'
import { useSnapshotStore } from '@/store/snapshotStore'

export interface InvoiceData {
  client: Client
  snapshot: Snapshot
  projectKeys: string[]
  configs: Record<string, ProjectConfig>
}

// Letter size: 612 x 792 pt
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 48
const CONTENT_W = PAGE_W - MARGIN * 2

// Colors
const SLATE_900 = rgb(0.07, 0.09, 0.14)
const SLATE_600 = rgb(0.27, 0.33, 0.42)
const SLATE_400 = rgb(0.58, 0.64, 0.72)
const ORANGE = rgb(0.957, 0.482, 0.125) // #F47B20 — LotusWorks brand orange

interface LineItem {
  project: string
  po: string
  regHrs: number
  otHrs: number
  dtHrs: number
  regRate: number
  otRate: number
  dtRate: number
  total: number
}

function buildLineItems(data: InvoiceData): LineItem[] {
  return data.projectKeys.map((key) => {
    const cfg = data.configs[key]
    const rows = data.snapshot.weeklyBilling.filter((r) => r.projectKey === key)

    const regHrs = rows.reduce((s, r) => s + r.regularHrs, 0)
    const otHrs = rows.reduce((s, r) => s + r.otHrs, 0)
    const dtHrs = rows.reduce((s, r) => s + r.dtHrs, 0)
    const regRate = cfg?.defaultRegularRate ?? 0
    const otRate = cfg?.otRateOverride ?? regRate * 1.5
    const dtRate = cfg?.dtRateOverride ?? regRate * 2
    const total =
      rows.reduce((s, r) => s + r.regularDollars + r.otDollars + r.dtDollars, 0)

    return {
      project: cfg?.displayName ?? key,
      po: cfg?.poNumber ?? '',
      regHrs,
      otHrs,
      dtHrs,
      regRate,
      otRate,
      dtRate,
      total,
    }
  })
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatHrs(n: number): string {
  return n.toFixed(2)
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
): void {
  page.drawText(text, { x, y, font, size, color })
}

function drawTextRight(
  page: PDFPage,
  text: string,
  rightEdge: number,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
): void {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: rightEdge - w, y, font, size, color })
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([PAGE_W, PAGE_H])

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // --- Embed logo ---
  let logoHeight = 0
  try {
    const logoBuf = await fetch('/lotusworks-logo.png').then((r) => r.arrayBuffer())
    const logoImg = await pdfDoc.embedPng(logoBuf)
    const intrinsic = logoImg.size()
    const maxDim = 60
    const scale = Math.min(maxDim / intrinsic.width, maxDim / intrinsic.height)
    const lw = intrinsic.width * scale
    const lh = intrinsic.height * scale
    logoHeight = lh
    page.drawImage(logoImg, {
      x: MARGIN,
      y: PAGE_H - MARGIN - lh,
      width: lw,
      height: lh,
    })
  } catch {
    // Logo unavailable — continue without it
    logoHeight = 0
  }

  // --- Header band ---
  const headerY = PAGE_H - MARGIN - Math.max(logoHeight, 20)

  // "LotusWorks" company name
  const logoRightX = MARGIN + 70
  drawText(page, 'LotusWorks', logoRightX, headerY + 4, fontBold, 18, SLATE_900)
  drawText(page, 'Finance & Billing', logoRightX, headerY - 14, fontRegular, 9, SLATE_600)

  // "INVOICE" right-aligned in orange
  drawTextRight(page, 'INVOICE', PAGE_W - MARGIN, headerY + 4, fontBold, 28, ORANGE)

  // Divider
  const divY = headerY - 28
  page.drawLine({
    start: { x: MARGIN, y: divY },
    end: { x: PAGE_W - MARGIN, y: divY },
    thickness: 1,
    color: SLATE_400,
    opacity: 0.3,
  })

  // --- Invoice number ---
  const invoiceNum =
    (data.client.invoiceNumberPrefix ?? '') +
    String(data.client.invoiceNumberCounter + 1).padStart(4, '0')
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Bill-to block (left)
  let billY = divY - 20
  drawText(page, 'BILL TO', MARGIN, billY, fontBold, 7.5, SLATE_400)
  billY -= 14
  drawText(page, data.client.name, MARGIN, billY, fontBold, 11, SLATE_900)
  if (data.client.address) {
    const addrLines = data.client.address.split('\n')
    for (const line of addrLines) {
      billY -= 13
      drawText(page, line, MARGIN, billY, fontRegular, 9, SLATE_600)
    }
  }

  // Invoice meta (right)
  const metaLabelX = PAGE_W - MARGIN - 160
  const metaValueX = PAGE_W - MARGIN
  let metaY = divY - 20

  const metaRows: Array<[string, string]> = [
    ['Invoice #', invoiceNum],
    ['Date', today],
    ['Period', data.snapshot.periodLabel],
    ['Payment Terms', data.client.paymentTerms],
  ]

  for (const [label, value] of metaRows) {
    drawText(page, label, metaLabelX, metaY, fontRegular, 8.5, SLATE_400)
    drawTextRight(page, value, metaValueX, metaY, fontBold, 8.5, SLATE_900)
    metaY -= 14
  }

  // --- Line items table ---
  const tableTopY = Math.min(billY, metaY) - 24

  // Column definitions
  const COL_PROJECT = MARGIN
  const COL_PO = MARGIN + 130
  const COL_REG_HRS = MARGIN + 195
  const COL_OT_HRS = MARGIN + 240
  const COL_DT_HRS = MARGIN + 280
  const COL_REG_RATE = MARGIN + 320
  const COL_OT_RATE = MARGIN + 365
  const COL_DT_RATE = MARGIN + 410
  const COL_TOTAL = PAGE_W - MARGIN

  const HEADER_H = 20
  const ROW_H = 18

  // Table header background
  page.drawRectangle({
    x: MARGIN,
    y: tableTopY - HEADER_H,
    width: CONTENT_W,
    height: HEADER_H,
    color: SLATE_900,
    opacity: 0.06,
  })

  const thY = tableTopY - 13
  const thColor = SLATE_400
  const thSize = 7

  // Left-aligned headers
  drawText(page, 'PROJECT', COL_PROJECT, thY, fontBold, thSize, thColor)
  drawText(page, 'PO', COL_PO, thY, fontBold, thSize, thColor)
  // Right-aligned headers
  drawTextRight(page, 'REG HRS', COL_REG_HRS + 40, thY, fontBold, thSize, thColor)
  drawTextRight(page, 'OT HRS', COL_OT_HRS + 35, thY, fontBold, thSize, thColor)
  drawTextRight(page, 'DT HRS', COL_DT_HRS + 35, thY, fontBold, thSize, thColor)
  drawTextRight(page, 'REG RATE', COL_REG_RATE + 42, thY, fontBold, thSize, thColor)
  drawTextRight(page, 'OT RATE', COL_OT_RATE + 42, thY, fontBold, thSize, thColor)
  drawTextRight(page, 'DT RATE', COL_DT_RATE + 42, thY, fontBold, thSize, thColor)
  drawTextRight(page, 'TOTAL', COL_TOTAL, thY, fontBold, thSize, thColor)

  const lineItems = buildLineItems(data)
  let rowY = tableTopY - HEADER_H

  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i]
    rowY -= ROW_H

    // Zebra stripe
    if (i % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: rowY - 4,
        width: CONTENT_W,
        height: ROW_H,
        color: SLATE_900,
        opacity: 0.03,
      })
    }

    const rowColor = SLATE_900
    const rowSize = 8.5

    drawText(page, item.project.slice(0, 22), COL_PROJECT, rowY + 4, fontRegular, rowSize, rowColor)
    drawText(page, item.po.slice(0, 12), COL_PO, rowY + 4, fontRegular, rowSize, rowColor)
    drawTextRight(page, formatHrs(item.regHrs), COL_REG_HRS + 40, rowY + 4, fontRegular, rowSize, rowColor)
    drawTextRight(page, formatHrs(item.otHrs), COL_OT_HRS + 35, rowY + 4, fontRegular, rowSize, rowColor)
    drawTextRight(page, formatHrs(item.dtHrs), COL_DT_HRS + 35, rowY + 4, fontRegular, rowSize, rowColor)
    drawTextRight(page, formatMoney(item.regRate), COL_REG_RATE + 42, rowY + 4, fontRegular, rowSize, rowColor)
    drawTextRight(page, formatMoney(item.otRate), COL_OT_RATE + 42, rowY + 4, fontRegular, rowSize, rowColor)
    drawTextRight(page, formatMoney(item.dtRate), COL_DT_RATE + 42, rowY + 4, fontRegular, rowSize, rowColor)
    drawTextRight(page, formatMoney(item.total), COL_TOTAL, rowY + 4, fontBold, rowSize, rowColor)
  }

  // --- Totals ---
  const regDollars = data.snapshot.weeklyBilling
    .filter((r) => data.projectKeys.includes(r.projectKey))
    .reduce((s, r) => s + r.regularDollars, 0)
  const otDollars = data.snapshot.weeklyBilling
    .filter((r) => data.projectKeys.includes(r.projectKey))
    .reduce((s, r) => s + r.otDollars, 0)
  const dtDollars = data.snapshot.weeklyBilling
    .filter((r) => data.projectKeys.includes(r.projectKey))
    .reduce((s, r) => s + r.dtDollars, 0)
  const grandTotal = regDollars + otDollars + dtDollars

  const sepY = rowY - 10
  page.drawLine({
    start: { x: MARGIN + 280, y: sepY },
    end: { x: PAGE_W - MARGIN, y: sepY },
    thickness: 0.5,
    color: SLATE_400,
    opacity: 0.4,
  })

  const totLabelX = MARGIN + 310
  const totValueX = PAGE_W - MARGIN
  let totY = sepY - 14

  const totRows: Array<[string, number, boolean]> = [
    ['Regular', regDollars, false],
    ['Overtime', otDollars, false],
    ['Double Time', dtDollars, false],
  ]

  for (const [label, amount, isBold] of totRows) {
    if (amount === 0 && label === 'Double Time') continue
    const f = isBold ? fontBold : fontRegular
    drawText(page, label, totLabelX, totY, f, 9, SLATE_600)
    drawTextRight(page, formatMoney(amount), totValueX, totY, f, 9, SLATE_600)
    totY -= 14
  }

  // Grand total row
  totY -= 4
  page.drawRectangle({
    x: MARGIN + 280,
    y: totY - 6,
    width: CONTENT_W - 280,
    height: 22,
    color: ORANGE,
    opacity: 0.12,
  })
  drawText(page, 'TOTAL DUE', totLabelX, totY + 4, fontBold, 10, SLATE_900)
  drawTextRight(page, formatMoney(grandTotal), totValueX, totY + 4, fontBold, 11, ORANGE)

  // --- Footer ---
  const footerTopY = 80
  page.drawLine({
    start: { x: MARGIN, y: footerTopY + 20 },
    end: { x: PAGE_W - MARGIN, y: footerTopY + 20 },
    thickness: 0.5,
    color: SLATE_400,
    opacity: 0.3,
  })

  const footY = footerTopY + 8
  if (data.client.paymentTerms) {
    drawText(
      page,
      `Payment Terms: ${data.client.paymentTerms}`,
      MARGIN,
      footY,
      fontRegular,
      8,
      SLATE_600,
    )
  }
  if (data.client.remitTo) {
    drawText(
      page,
      `Remit To: ${data.client.remitTo.replace(/\n/g, ' | ')}`,
      MARGIN,
      footY - 13,
      fontRegular,
      8,
      SLATE_600,
    )
  }
  if (data.client.footerNotes) {
    drawText(page, data.client.footerNotes.slice(0, 100), MARGIN, footY - 26, fontRegular, 7.5, SLATE_400)
  }

  // Page number
  drawTextRight(page, 'Page 1 of 1', PAGE_W - MARGIN, MARGIN - 10, fontRegular, 7.5, SLATE_400)

  // Serialize & update state
  const bytes = await pdfDoc.save()

  // Increment invoice counter and append audit
  const updatedClient: Client = {
    ...data.client,
    invoiceNumberCounter: data.client.invoiceNumberCounter + 1,
  }
  const store = useSnapshotStore.getState()
  await store.upsertClient(updatedClient)
  store.appendAudit(
    'invoice-generated',
    `Invoice ${invoiceNum} generated for ${data.client.name}`,
  )

  return bytes
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

import { parsePdf } from '@/parsers/pdfParser'
import type { PdfParseResult } from '@/parsers/pdfParser'

interface PdfWorkerInput {
  buffer: ArrayBuffer
  fileName: string
}

self.onmessage = async (e: MessageEvent<PdfWorkerInput>) => {
  const { buffer, fileName } = e.data
  try {
    const result: PdfParseResult = await parsePdf(buffer, fileName)
    self.postMessage({ ok: true, result })
  } catch (err) {
    self.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

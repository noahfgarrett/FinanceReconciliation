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
    // Transfer the bytes back so the main thread can store them without an extra copy.
    const transfers: Transferable[] = []
    if (result.pdfBytes) transfers.push(result.pdfBytes)
    const post = self.postMessage as (msg: unknown, transfer?: Transferable[]) => void
    post({ ok: true, result }, transfers)
  } catch (err) {
    self.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

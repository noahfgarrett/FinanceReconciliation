import { parsePdf, type PdfParseResult } from './pdfParser'

export interface PdfFileResult {
  fileName: string
  result: PdfParseResult
}

/**
 * Parse a list of PDF files. We run on the MAIN THREAD because pdfjs spawns
 * its own dedicated worker for the heavy lifting (configured in
 * `pdfjsConfig.ts`). A previous design wrapped each parse in our own outer
 * Worker too, which made parsing nested-workered — a configuration that
 * Chromium doesn't reliably support under viteSingleFile bundling. The UI
 * stays responsive because pdfjs.getDocument() does its work off-thread.
 *
 * Files are processed sequentially. For typical monthly batches (20–30
 * weekly PDFs) this completes in under 30 seconds with the user seeing
 * incremental progress.
 */
export async function runPdfsInWorker(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<PdfFileResult[]> {
  const results: PdfFileResult[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const buffer = await file.arrayBuffer()
    const result = await parsePdf(buffer, file.name)
    results.push({ fileName: file.name, result })
    onProgress?.(i + 1, files.length)
  }
  return results
}

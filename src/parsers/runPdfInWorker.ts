import type { PdfParseResult } from './pdfParser'

const MAX_CONCURRENT = 4

interface WorkerResponse {
  ok: boolean
  result?: PdfParseResult
  error?: string
}

export interface PdfFileResult {
  fileName: string
  result: PdfParseResult
}

export async function runPdfsInWorker(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<PdfFileResult[]> {
  const results: PdfFileResult[] = new Array(files.length)
  let next = 0
  let completed = 0

  async function runOne(idx: number): Promise<void> {
    const file = files[idx]
    const buffer = await file.arrayBuffer()
    const result = await new Promise<PdfParseResult>((resolveP, rejectP) => {
      const w = new Worker(
        new URL('./workers/pdf.worker.ts', import.meta.url),
        { type: 'module' },
      )
      w.onmessage = (e: MessageEvent<WorkerResponse>) => {
        w.terminate()
        if (e.data.ok && e.data.result) {
          resolveP(e.data.result)
        } else {
          rejectP(new Error(e.data.error ?? 'PDF worker failed'))
        }
      }
      w.onerror = (err) => {
        w.terminate()
        // Surface as much detail as the browser gives us — the generic
        // "PDF worker failed" string was hiding the actual root cause.
        const detail = [
          err.message,
          err.filename ? `at ${err.filename}` : null,
          err.lineno ? `line ${err.lineno}` : null,
          err.error instanceof Error ? err.error.message : null,
        ]
          .filter(Boolean)
          .join(' · ')
        rejectP(
          err.error instanceof Error
            ? err.error
            : new Error(`PDF worker failed${detail ? `: ${detail}` : ''}`),
        )
      }
      w.postMessage({ buffer, fileName: file.name }, [buffer])
    })
    results[idx] = { fileName: file.name, result }
    completed++
    onProgress?.(completed, files.length)
  }

  const slots: Promise<void>[] = []
  for (let i = 0; i < Math.min(MAX_CONCURRENT, files.length); i++) {
    slots.push(
      (async () => {
        while (next < files.length) {
          const my = next++
          await runOne(my)
        }
      })(),
    )
  }
  await Promise.all(slots)
  return results
}

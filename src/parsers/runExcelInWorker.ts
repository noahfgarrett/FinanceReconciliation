import type { ExcelParseResult } from './excelParser'

interface WorkerResponse {
  ok: boolean
  result?: ExcelParseResult
  error?: string
}

export function runExcelInWorker(buffer: ArrayBuffer): Promise<ExcelParseResult> {
  return new Promise((resolveP, rejectP) => {
    const worker = new Worker(
      new URL('./workers/excel.worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      worker.terminate()
      if (e.data.ok && e.data.result) {
        resolveP(e.data.result)
      } else {
        rejectP(new Error(e.data.error ?? 'Unknown worker error'))
      }
    }
    worker.onerror = (err) => {
      worker.terminate()
      rejectP(err.error instanceof Error ? err.error : new Error(err.message ?? 'Worker error'))
    }
    worker.postMessage(buffer, [buffer])
  })
}

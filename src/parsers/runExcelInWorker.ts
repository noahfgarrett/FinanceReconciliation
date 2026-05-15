import type { ExcelParseResult } from './excelParser'

// Vite's `?worker&inline` bundles the worker source into a blob URL so the
// single-file build works from file:// without a separate .js file.
import ExcelWorkerConstructor from './workers/excel.worker.ts?worker&inline'

interface WorkerResponse {
  ok: boolean
  result?: ExcelParseResult
  error?: string
}

export function runExcelInWorker(buffer: ArrayBuffer): Promise<ExcelParseResult> {
  return new Promise((resolveP, rejectP) => {
    const worker: Worker = new ExcelWorkerConstructor()
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

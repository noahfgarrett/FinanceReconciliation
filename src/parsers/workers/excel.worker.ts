import { parseExcel } from '@/parsers/excelParser'
import type { ExcelParseResult } from '@/parsers/excelParser'

self.onmessage = (e: MessageEvent<ArrayBuffer>) => {
  try {
    const result: ExcelParseResult = parseExcel(e.data)
    self.postMessage({ ok: true, result })
  } catch (err) {
    self.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

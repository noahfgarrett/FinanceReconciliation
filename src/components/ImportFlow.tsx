import { useCallback, useRef, useState } from 'react'
import { DropZone } from './DropZone'
import { useSnapshotStore } from '@/store/snapshotStore'
import { generateSampleData } from '@/lib/sampleData'
import { runExcelInWorker } from '@/parsers/runExcelInWorker'
import { runPdfsInWorker } from '@/parsers/runPdfInWorker'
import type { ExcelParseResult } from '@/parsers/excelParser'
import type { RowFlag } from '@/persistence/schemas'

/** Infer a human-readable period label (e.g. "Apr 2026") from an ISO date string. */
function periodLabelFromDate(iso: string): string {
  if (!iso) return 'Unknown Period'
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Given a list of ISO date strings, return the label for the median date's month+year.
 * Falls back to 'Unknown Period' when the list is empty.
 */
function inferPeriodLabel(isoDates: string[]): string {
  if (isoDates.length === 0) return 'Unknown Period'
  const sorted = [...isoDates].sort()
  const medianIdx = Math.floor(sorted.length / 2)
  return periodLabelFromDate(sorted[medianIdx])
}

export function ImportFlow() {
  const importBatch = useSnapshotStore((s) => s.importBatch)
  const addRecentImport = useSnapshotStore((s) => s.addRecentImport)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Hold parsed Excel result in a ref so PDF can reference it later
  const excelResultRef = useRef<ExcelParseResult | null>(null)
  const excelFileRef = useRef<File | null>(null)

  async function loadSample() {
    setStatus('Generating sample data…')
    setBusy(true)
    try {
      const data = generateSampleData()
      await importBatch(data)
      await addRecentImport({ folderName: 'Sample Data' })
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  const handleExcel = useCallback(async (file: File) => {
    setBusy(true)
    setStatus(`Parsing ${file.name}…`)
    try {
      const buffer = await file.arrayBuffer()
      const result = await runExcelInWorker(buffer)
      excelResultRef.current = result
      excelFileRef.current = file

      if (result.warnings.some((w) => w.code === 'parse-failure' && w.severity === 'error')) {
        const msg = result.warnings.find((w) => w.code === 'parse-failure')?.message ?? 'Parse failed'
        setStatus(`Excel error: ${msg}`)
      } else {
        const warnCount = result.warnings.length
        setStatus(
          `Excel parsed: ${result.rows.length} rows, ${result.employees.length} employees${warnCount ? ` (${warnCount} warning${warnCount > 1 ? 's' : ''})` : ''}. Now drop the PDF folder.`,
        )
      }
    } catch (err) {
      setStatus(`Excel parse failed: ${err instanceof Error ? err.message : String(err)}`)
      excelResultRef.current = null
    } finally {
      setBusy(false)
    }
  }, [])

  const handlePdfFolder = useCallback(
    async (files: File[]) => {
      if (!excelResultRef.current) {
        setStatus('Drop the monthly Excel first, then the PDF folder.')
        return
      }

      const pdfFiles = files.filter((f) => /\.pdf$/i.test(f.name))
      if (pdfFiles.length === 0) {
        setStatus('No PDF files found in the selected folder.')
        return
      }

      setBusy(true)
      setStatus(`Parsing 0 / ${pdfFiles.length} PDFs…`)

      try {
        const pdfResults = await runPdfsInWorker(pdfFiles, (done, total) => {
          setStatus(`Parsing ${done} / ${total} PDFs…`)
        })

        const parsedPdfs = pdfResults
          .map((r) => r.result.parsed)
          .filter((p): p is NonNullable<typeof p> => p !== null)

        const allWarnings: RowFlag[] = [
          ...excelResultRef.current.warnings,
          ...pdfResults.flatMap((r) => r.result.warnings),
        ]

        // Collect entry dates for period label inference
        const entryDates = parsedPdfs.flatMap((p) => p.entries.map((e) => e.date))
        const periodLabel = inferPeriodLabel(entryDates)

        await importBatch({
          excelRows: excelResultRef.current.rows,
          employees: excelResultRef.current.employees,
          parsedPdfs,
          periodLabel,
        })

        const failedPdfs = pdfResults.filter((r) => r.result.parsed === null).length
        const warnCount = allWarnings.length
        await addRecentImport({
          excelName: excelFileRef.current?.name,
          folderName: `${pdfFiles.length} PDF${pdfFiles.length !== 1 ? 's' : ''}`,
        })

        setStatus(
          `Imported ${parsedPdfs.length} PDFs, ${excelResultRef.current.rows.length} Excel rows — ${periodLabel}.${
            failedPdfs > 0 ? ` ${failedPdfs} PDF(s) could not be parsed.` : ''
          }${warnCount > 0 ? ` ${warnCount} warning(s).` : ''}`,
        )
        excelResultRef.current = null
        excelFileRef.current = null
      } catch (err) {
        setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setBusy(false)
      }
    },
    [importBatch, addRecentImport],
  )

  return (
    <DropZone
      onExcel={handleExcel}
      onPdfFolder={handlePdfFolder}
      onLoadSample={loadSample}
      busy={busy}
      status={status ?? undefined}
    />
  )
}

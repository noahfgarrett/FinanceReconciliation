import { useRef, useState, type DragEvent } from 'react'
import { FolderUp, FileSpreadsheet, Sparkles, FileText, ArrowRight } from 'lucide-react'

interface Props {
  onExcel?: (file: File) => void
  onPdfFolder?: (files: File[]) => void
  onLoadSample?: () => void
  busy?: boolean
  status?: string
}

export function DropZone({ onExcel, onPdfFolder, onLoadSample, busy, status }: Props) {
  const [hover, setHover] = useState(false)
  const excelRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setHover(false)
    const files = Array.from(e.dataTransfer.files)
    const xlsx = files.find((f) => /\.xlsx$/i.test(f.name))
    if (xlsx && onExcel) onExcel(xlsx)
    const pdfs = files.filter((f) => /\.pdf$/i.test(f.name))
    if (pdfs.length && onPdfFolder) onPdfFolder(pdfs)
  }

  return (
    <div className="mx-8 my-6">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setHover(true)
        }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 ease-out-expo overflow-hidden ${
          hover
            ? 'border-lw-orange-500 bg-lw-orange-500/[0.04] scale-[1.005]'
            : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
        } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {/* decorative gradient mesh */}
        <div
          aria-hidden
          className="absolute inset-0 bg-mesh opacity-70 pointer-events-none transition-opacity duration-300"
          style={{ opacity: hover ? 1 : 0.55 }}
        />
        {/* radial glow */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-48 pointer-events-none"
          style={{ background: 'radial-gradient(50% 100% at 50% 0%, rgba(244,123,32,0.12) 0%, transparent 70%)' }}
        />

        <div className="relative px-8 py-12 text-center">
          {/* icon stack — Excel + arrow + PDF */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="relative w-12 h-12 rounded-xl bg-lw-blue-700/15 border border-lw-blue-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-lw-blue-300" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <div
              className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br from-lw-orange-500 to-lw-orange-600 flex items-center justify-center shadow-glow-orange transition-transform duration-300 ${
                hover ? 'scale-110' : ''
              }`}
            >
              <FolderUp className="w-6 h-6 text-white" />
              {hover && (
                <span className="absolute inset-0 rounded-2xl ring-4 ring-lw-orange-500/30 animate-pulse-glow" />
              )}
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <div className="relative w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
              <FileText className="w-5 h-5 text-red-300" />
            </div>
          </div>

          <div className="font-display text-xl font-semibold text-slate-100 tracking-tight">
            {hover ? 'Release to begin reconciliation' : 'Drop your monthly Excel + PDF folder'}
          </div>
          <div className="text-sm text-slate-400 mt-1.5">
            One spreadsheet of weekly hours, plus a folder of project PDFs.
          </div>

          {/* primary actions */}
          <div className="flex gap-2 justify-center mt-7 flex-wrap">
            <button
              onClick={() => excelRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-slate-900 hover:bg-slate-800 active:scale-[0.98] border border-slate-700 hover:border-slate-600 rounded-lg text-slate-100 transition-all duration-150 ease-out-expo"
            >
              <FileSpreadsheet className="w-4 h-4 text-lw-blue-300" /> Choose Excel
            </button>
            <button
              onClick={() => folderRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-slate-900 hover:bg-slate-800 active:scale-[0.98] border border-slate-700 hover:border-slate-600 rounded-lg text-slate-100 transition-all duration-150 ease-out-expo"
            >
              <FolderUp className="w-4 h-4 text-lw-orange-400" /> Choose Folder
            </button>
          </div>

          {/* tertiary "load sample" option, below the fold */}
          {onLoadSample && (
            <div className="mt-6 pt-6 border-t border-slate-800/80">
              <button
                onClick={onLoadSample}
                className="group inline-flex items-center gap-2 text-sm text-slate-400 hover:text-lw-orange-300 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-lw-orange-400 group-hover:rotate-12 transition-transform duration-300 ease-out-back" />
                <span>Or explore with sample data</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
              </button>
            </div>
          )}

          {status && (
            <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-lw-orange-400 animate-pulse" />
              {status}
            </div>
          )}
        </div>

        {/* hidden inputs */}
        <input
          ref={excelRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f && onExcel) onExcel(f)
            e.target.value = ''
          }}
        />
        <input
          ref={folderRef}
          type="file"
          // @ts-expect-error webkitdirectory is non-standard
          webkitdirectory=""
          multiple
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).filter((f) => /\.pdf$/i.test(f.name))
            if (files.length && onPdfFolder) onPdfFolder(files)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

import { useRef, useState, type DragEvent } from 'react'
import { FolderUp, FileSpreadsheet, Sparkles } from 'lucide-react'

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
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setHover(true)
      }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
      className={`mx-8 my-6 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
        hover ? 'border-lw-orange-500 bg-lw-orange-500/5' : 'border-slate-800 bg-slate-900/30'
      } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <FolderUp className="w-10 h-10 mx-auto text-lw-orange-400 mb-3" />
      <div className="text-slate-200 font-medium">Drop monthly Excel + PDF folder here</div>
      <div className="text-sm text-slate-500 mt-1">or pick files manually:</div>
      <div className="flex gap-3 justify-center mt-4 flex-wrap">
        <button
          onClick={() => excelRef.current?.click()}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-slate-200 hover:bg-slate-800"
        >
          <FileSpreadsheet className="w-4 h-4" /> Choose Excel
        </button>
        <button
          onClick={() => folderRef.current?.click()}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-slate-200 hover:bg-slate-800"
        >
          <FolderUp className="w-4 h-4" /> Choose Folder
        </button>
        {onLoadSample && (
          <button
            onClick={onLoadSample}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-lw-orange-500 hover:bg-lw-orange-600 text-white rounded-lg shadow-[0_4px_14px_rgba(249,115,22,0.3)]"
          >
            <Sparkles className="w-4 h-4" /> Load Sample Data
          </button>
        )}
      </div>
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
      {status && <div className="text-xs text-slate-400 mt-3">{status}</div>}
    </div>
  )
}

import { useRef, useState, type DragEvent } from 'react'
import { FolderUp, FileSpreadsheet, FileText, ArrowRight } from 'lucide-react'

interface Props {
  onExcel?: (file: File) => void
  onPdfFolder?: (files: File[]) => void
  busy?: boolean
  status?: string
}

/** Read all files from a FileSystemDirectoryEntry recursively. */
async function readDirRecursive(dir: FileSystemDirectoryEntry): Promise<File[]> {
  const reader = dir.createReader()
  const files: File[] = []
  // readEntries may return results in batches — keep calling until empty
  let batch: FileSystemEntry[] = []
  do {
    batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    for (const entry of batch) {
      if (entry.isDirectory) {
        files.push(...await readDirRecursive(entry as FileSystemDirectoryEntry))
      } else if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          ;(entry as FileSystemFileEntry).file(resolve, reject)
        })
        files.push(file)
      }
    }
  } while (batch.length > 0)
  return files
}

/** Flatten all files from a drop event, traversing directories via webkitGetAsEntry. */
async function extractDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const items = dataTransfer.items
  const files: File[] = []

  if (items?.length) {
    const entries: FileSystemEntry[] = []
    // Collect entries synchronously first — items list is cleared after the event
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.()
      if (entry) entries.push(entry)
    }
    for (const entry of entries) {
      if (entry.isDirectory) {
        files.push(...await readDirRecursive(entry as FileSystemDirectoryEntry))
      } else if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          ;(entry as FileSystemFileEntry).file(resolve, reject)
        })
        files.push(file)
      }
    }
  }

  // Fallback: if webkitGetAsEntry wasn't available, use flat files list
  if (files.length === 0) {
    files.push(...Array.from(dataTransfer.files))
  }

  return files
}

export function DropZone({ onExcel, onPdfFolder, busy, status }: Props) {
  const [hover, setHover] = useState(false)
  const excelRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  async function onDrop(e: DragEvent<HTMLDivElement>): Promise<void> {
    e.preventDefault()
    setHover(false)
    const files = await extractDroppedFiles(e.dataTransfer)
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
        className={`relative rounded-2xl border-2 border-dashed bg-[#0a0f1c] transition-all duration-300 ease-out-expo overflow-hidden ${
          hover
            ? 'border-lw-orange-500 scale-[1.005]'
            : 'border-slate-700 hover:border-slate-600'
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
          data-testid="excel-input"
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
          data-testid="pdf-folder-input"
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

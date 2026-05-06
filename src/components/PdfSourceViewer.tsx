import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FileX, Loader2 } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { pdfjs } from '@/parsers/pdfjsConfig'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { SourceLocation } from '@/persistence/schemas'

type Zoom = 'fit' | 1 | 1.5

interface PdfSourceViewerProps {
  open: boolean
  onClose: () => void
  /** Original PDF bytes; null if unavailable (e.g., snapshot loaded from JSON export). */
  pdfBytes: ArrayBuffer | null
  /** Bounding boxes in PDF point space to outline. */
  highlights: SourceLocation[]
  /** Page to land on initially; defaults to highlights[0].pageIndex or 1. */
  initialPage?: number
  fileName?: string
}

interface RenderedHighlight {
  pageIndex: number
  /** Pixel-space rect on the canvas. */
  left: number
  top: number
  width: number
  height: number
}

const HIGHLIGHT_COLOR = '#F47B20'

export function PdfSourceViewer({
  open,
  onClose,
  pdfBytes,
  highlights,
  initialPage,
  fileName,
}: PdfSourceViewerProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pageIndex, setPageIndex] = useState<number>(initialPage ?? highlights[0]?.pageIndex ?? 1)
  const [zoom, setZoom] = useState<Zoom>('fit')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<RenderedHighlight[]>([])

  // Highlights for the currently displayed page
  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.pageIndex === pageIndex),
    [highlights, pageIndex],
  )

  // Load the PDF when bytes change
  useEffect(() => {
    if (!open || !pdfBytes) {
      setDoc(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    // pdfjs.getDocument({data}) consumes the buffer — clone first
    // so the original stays usable for subsequent opens.
    const cloned = pdfBytes.slice(0)
    const task = pdfjs.getDocument({ data: cloned })
    task.promise
      .then((d) => {
        if (cancelled) {
          d.destroy()
          return
        }
        setDoc(d)
        const initial = initialPage ?? highlights[0]?.pageIndex ?? 1
        setPageIndex(Math.min(Math.max(1, initial), d.numPages))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load PDF')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      task.destroy()
    }
    // We deliberately exclude `highlights` and `initialPage` so reloading the
    // viewer for a different row doesn't refetch the same PDF document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pdfBytes])

  // Render the current page when it or the zoom level changes
  useEffect(() => {
    if (!open || !doc) return
    let cancelled = false

    async function render(): Promise<void> {
      if (!doc) return
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      try {
        const page = await doc.getPage(pageIndex)
        if (cancelled) return

        const baseViewport = page.getViewport({ scale: 1 })
        let scale: number
        if (zoom === 'fit') {
          // Fit-to-width with a small horizontal padding
          const containerWidth = container.clientWidth - 24
          scale = containerWidth / baseViewport.width
        } else {
          scale = zoom
        }
        const viewport = page.getViewport({ scale })

        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        // Cancel any in-flight render before starting a new one
        renderTaskRef.current?.cancel()
        const task = page.render({ canvasContext: ctx, viewport })
        renderTaskRef.current = task
        await task.promise
        if (cancelled) return

        // Compute pixel-space rectangles for each highlight
        const rendered: RenderedHighlight[] = pageHighlights.map((h) => {
          // PDF origin is bottom-left, canvas origin is top-left.
          // viewport.convertToViewportPoint handles the y-flip.
          const [x1, y1] = viewport.convertToViewportPoint(h.x, h.y)
          const [x2, y2] = viewport.convertToViewportPoint(h.x + h.width, h.y + h.height)
          const left = Math.min(x1, x2)
          const top = Math.min(y1, y2)
          const width = Math.abs(x2 - x1)
          const height = Math.abs(y2 - y1)
          return { pageIndex: h.pageIndex, left, top, width, height }
        })
        setOverlay(rendered)
      } catch (err: unknown) {
        if (cancelled) return
        // Render-cancel rejections are expected when paging quickly; ignore them.
        const msg = err instanceof Error ? err.message : String(err)
        if (!msg.includes('cancelled')) setError(msg)
      }
    }

    void render()

    return () => {
      cancelled = true
    }
  }, [doc, pageIndex, zoom, open, pageHighlights])

  // Cleanup the document when the modal closes
  useEffect(() => {
    if (open) return
    if (doc) {
      void doc.destroy()
      setDoc(null)
    }
  }, [open, doc])

  const numPages = doc?.numPages ?? 0
  const canPrev = pageIndex > 1
  const canNext = pageIndex < numPages

  return (
    <Modal open={open} onClose={onClose} width="3xl">
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold text-slate-100 truncate">
              {fileName ?? 'Source PDF'}
            </h2>
            {numPages > 0 && (
              <div className="text-xs text-slate-500 mt-0.5">
                Page {pageIndex} of {numPages}
                {pageHighlights.length > 0 && (
                  <> · <span className="text-lw-orange-400">{pageHighlights.length} highlight{pageHighlights.length === 1 ? '' : 's'}</span></>
                )}
              </div>
            )}
          </div>

          {/* Zoom toggle */}
          {doc && (
            <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden">
              <ZoomButton active={zoom === 'fit'} onClick={() => setZoom('fit')} label="Fit" />
              <ZoomButton active={zoom === 1} onClick={() => setZoom(1)} label="100%" />
              <ZoomButton active={zoom === 1.5} onClick={() => setZoom(1.5)} label="150%" />
            </div>
          )}

          {/* Pagination */}
          {numPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={!canPrev}
                onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!canNext}
                onClick={() => setPageIndex((p) => Math.min(numPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>

        {/* Body */}
        <div ref={containerRef} className="flex-1 overflow-auto bg-slate-950 p-3 min-h-[300px]">
          {!pdfBytes && (
            <EmptyState />
          )}
          {pdfBytes && loading && (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading PDF…</span>
            </div>
          )}
          {pdfBytes && error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileX className="w-8 h-8 text-red-400 mb-2" />
              <div className="text-sm text-red-300">Failed to render PDF</div>
              <div className="text-xs text-slate-500 mt-1">{error}</div>
            </div>
          )}
          {pdfBytes && !error && (
            <div className="relative inline-block mx-auto" style={{ display: 'block', textAlign: 'center' }}>
              <div className="relative inline-block">
                <canvas ref={canvasRef} className="block bg-white shadow-lg rounded-sm" />
                {overlay.map((r, i) => (
                  <div
                    key={i}
                    className="absolute pointer-events-none rounded-sm"
                    style={{
                      left: r.left,
                      top: r.top,
                      width: r.width,
                      height: r.height,
                      border: `2px solid ${HIGHLIGHT_COLOR}cc`,
                      backgroundColor: `${HIGHLIGHT_COLOR}14`,
                      boxShadow: `0 0 0 1px ${HIGHLIGHT_COLOR}33`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

interface ZoomButtonProps {
  active: boolean
  onClick: () => void
  label: string
}

function ZoomButton({ active, onClick, label }: ZoomButtonProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-xs transition-colors ${
        active
          ? 'bg-lw-orange-500/20 text-lw-orange-400'
          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  )
}

function EmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
      <FileX className="w-10 h-10 text-slate-600 mb-3" />
      <div className="text-sm font-medium text-slate-300 mb-1">
        Original PDF not available for this snapshot
      </div>
      <div className="text-xs text-slate-500 leading-relaxed">
        To enable source verification, re-import the original PDFs. JSON exports
        do not include PDF bytes to keep file sizes small.
      </div>
    </div>
  )
}

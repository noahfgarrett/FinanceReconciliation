import * as pdfjs from 'pdfjs-dist'

// pdfjs spawns ITS OWN worker for the heavy lifting. We construct that worker
// eagerly via Vite's `?worker&inline` and hand it to pdfjs as a workerPort,
// avoiding all the URL-resolution-against-import-meta-url quirks under
// viteSingleFile bundling. The pdfjs worker source lives inline as a blob URL,
// no separate file needs deploying.
//
// IMPORTANT: this module is intended to run on the MAIN THREAD, not from
// inside another Worker. Nested module workers are unreliable across browsers
// (parser-worker → pdfjs-worker spawn fails or falls back to fake-worker which
// itself crashes mid-parse). Keep PDF parsing main-thread-driven; pdfjs's own
// worker still keeps the UI responsive.
import PdfJsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'

pdfjs.GlobalWorkerOptions.workerPort = new PdfJsWorker()

export { pdfjs }

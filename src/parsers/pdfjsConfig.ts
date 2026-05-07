import * as pdfjs from 'pdfjs-dist'

// We hand pdfjs a pre-built Worker via `workerPort` instead of a `workerSrc`
// URL it has to spawn from inside our outer worker. This works around two
// production failures:
//
//  1. Nested module workers (parser-worker → pdfjs-worker) are unreliable
//     across browsers. Chromium under viteSingleFile bundling either fails
//     the spawn or falls back to "fake worker" which then dynamic-imports
//     a path that doesn't exist.
//
//  2. With `?worker&inline`, Vite inlines the pdfjs worker source as a blob
//     URL bundled into our chunk, so no separate file needs deploying and
//     resolution-against-import-meta-url quirks don't apply.
//
// We construct the worker once at module load and assign it to
// `GlobalWorkerOptions.workerPort`. pdfjs uses it directly without trying
// to spawn anything itself.
import PdfJsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'

pdfjs.GlobalWorkerOptions.workerPort = new PdfJsWorker()

export { pdfjs }

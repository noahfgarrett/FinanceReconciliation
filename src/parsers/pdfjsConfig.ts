import * as pdfjs from 'pdfjs-dist'
// Dev: Vite resolves `?url` to the node_modules file at request time.
// Prod: this import is dropped/empty inside worker chunks under viteSingleFile,
// so we fall through to a relative URL resolved against the worker chunk's own
// location, with the actual `.mjs` file shipped by `deploy-pages.sh`.
import workerSrcDev from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc =
  import.meta.env.DEV && workerSrcDev
    ? workerSrcDev
    : new URL('./pdf.worker.min.mjs', import.meta.url).href

export { pdfjs }

// We import the LEGACY build of pdfjs-dist (a single self-contained module
// that does NOT spawn its own worker). This avoids two production failure
// modes we hit with the regular build:
//
//  1. Nested module workers — when our outer parser worker calls
//     pdfjs.getDocument(), pdfjs in the regular build wants to spawn its own
//     module worker. Browsers (especially under viteSingleFile bundling)
//     handle nested module workers inconsistently and the worker either
//     404s (because `?url` imports are dropped inside chunks) or silently
//     falls back to "fake worker" mode that crashes mid-parse.
//
//  2. The `?url` import for the worker is consumed by viteSingleFile and
//     produces an empty value, so pdfjs's internal default of
//     `"./pdf.worker.mjs"` kicks in — a path we never deployed.
//
// The legacy build inlines the worker code into the main module so
// `getDocument()` runs synchronously on whatever thread imported it. We're
// already inside our own dedicated outer worker per file, so the cost of
// no-worker-inside-pdfjs is irrelevant — we still parse off the main thread.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

// Tell pdfjs there is no separate worker — it will fall back to running
// inline. (Without this, pdfjs may still attempt to spawn a worker.)
pdfjs.GlobalWorkerOptions.workerSrc = ''

export { pdfjs }

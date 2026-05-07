#!/bin/bash
set -euo pipefail

# deploy-pages.sh — Build LotusWorks Reconciler and deploy to GitHub Pages
# Usage: ./deploy-pages.sh

REPO="https://github.com/noahfgarrett/FinanceReconciliation.git"
DEPLOY_DIR=".gh-pages-temp"

echo "==> Building Reconciler..."
npm run build

echo "==> Preparing gh-pages content..."
rm -rf "$DEPLOY_DIR"
mkdir "$DEPLOY_DIR"

# Copy the built HTML as index.html (GitHub Pages serves index.html by default)
cp dist/Reconciler.html "$DEPLOY_DIR/index.html"

# Inject service worker registration into <head> (no PWA manifest — desktop-only app)
node -e "
const fs = require('fs');
const html = fs.readFileSync('$DEPLOY_DIR/index.html', 'utf-8');
const swHead = \`
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(function(reg) {
    reg.addEventListener('updatefound', function() {
      var newWorker = reg.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', function() {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            console.log('LotusWorks Reconciler updated — refresh for the latest version');
          }
        });
      }
    });
  });
  // Listen for update-available messages from the service worker
  navigator.serviceWorker.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
      if (confirm('A new version of LotusWorks Reconciler is available. Reload now?')) {
        window.location.reload();
      }
    }
  });
}
<\\/script>\`;

const updated = html.replace('<head>', '<head>' + swHead);
fs.writeFileSync('$DEPLOY_DIR/index.html', updated);
console.log('  Service worker registration injected into index.html');
"

# Copy service worker (logo is now inlined into Reconciler.html as a data URI
# via the bundled import in src/assets/, so no separate file is needed)
cp sw.js "$DEPLOY_DIR/"

# Copy any worker chunks the bundle references at runtime (Vite emits these
# as separate files even with viteSingleFile, because Worker(new URL(...))
# imports must resolve at runtime). Without these, real Excel/PDF parsing
# would 404 on the live site.
shopt -s nullglob
WORKER_FILES=(dist/*.worker-*.js dist/*.worker-*.js.map)
if (( ${#WORKER_FILES[@]} > 0 )); then
  cp "${WORKER_FILES[@]}" "$DEPLOY_DIR/"
  echo "  Copied ${#WORKER_FILES[@]} worker chunk(s)"
fi
shopt -u nullglob

# Ship pdfjs's own worker file alongside our outer worker chunks so that
# `new URL('./pdf.worker.min.mjs', import.meta.url)` inside the bundled
# pdfjsConfig resolves correctly in production. Without this, real-PDF
# parsing 404s once the outer worker tries to spawn pdfjs.
if [ -f node_modules/pdfjs-dist/build/pdf.worker.min.mjs ]; then
  cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs "$DEPLOY_DIR/"
  echo "  Copied pdfjs worker (pdf.worker.min.mjs)"
else
  echo "  WARNING: pdfjs-dist worker file not found — real-PDF parsing will fail" >&2
fi

echo "==> Deploying to gh-pages branch..."
cd "$DEPLOY_DIR"
git init -q
git checkout -q -b gh-pages
git add -A
git commit -q -m "Deploy LotusWorks Reconciler to GitHub Pages"
git remote add origin "$REPO"
git push -f origin gh-pages

cd ..
rm -rf "$DEPLOY_DIR"

echo ""
echo "==> Deployed! Configuring GitHub Pages..."

# Enable GitHub Pages (create or update)
gh api repos/noahfgarrett/FinanceReconciliation/pages \
  -X POST \
  -f "source[branch]=gh-pages" \
  -f "source[path]=/" 2>/dev/null || \
gh api repos/noahfgarrett/FinanceReconciliation/pages \
  -X PUT \
  -f "source[branch]=gh-pages" \
  -f "source[path]=/" 2>/dev/null || \
echo "  (Pages may already be configured — check https://github.com/noahfgarrett/FinanceReconciliation/settings/pages)"

echo ""
echo "==> Done! Your app will be live at:"
echo "    https://noahfgarrett.github.io/FinanceReconciliation/"
echo ""
echo "    It may take 1-2 minutes for GitHub Pages to deploy."

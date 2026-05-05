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

# Copy service worker and logo
cp sw.js "$DEPLOY_DIR/"
cp public/lotusworks-logo.png "$DEPLOY_DIR/"

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

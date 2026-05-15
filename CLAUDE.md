# CLAUDE.md — FinanceReconciliation (LotusWorks Reconciler)

## Project Overview

Internal billing-hours reconciliation tool for LotusWorks. Imports Paycom Excel summaries and PDF timesheets, reconciles hours across employees/projects/weeks, and generates invoices and exports. Single-page app deployed as a static site — all data stays local in IndexedDB.

## Stack

- **Framework**: React 18 + TypeScript (strict mode)
- **Build**: Vite (single-file output via `vite-plugin-singlefile`)
- **Styling**: Tailwind CSS with CSS custom property token system
- **State**: Zustand stores (`src/store/`)
- **Tables**: TanStack Table + TanStack Virtual
- **Persistence**: IndexedDB via `idb` wrapper (`src/persistence/`)
- **PDF parsing**: pdfjs-dist (worker runs on main thread, not nested)
- **Excel parsing**: exceljs
- **Testing**: Vitest (unit), Playwright (e2e)
- **Linting**: ESLint (zero warnings policy)

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # TypeScript check + Vite build → dist/Reconciler-v{version}.html
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint, must pass with --max-warnings=0
npm run test         # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
npm run e2e          # Playwright end-to-end tests
```

## Project Structure

```
src/
  components/     # Shared UI components
  data/           # Static data (changelog, sample data)
  exports/        # Invoice PDF / Excel / JSON export logic
  lib/            # Shared utilities and helpers
  pages/          # Route-level page components
  parsers/        # Excel and PDF file parsers
  persistence/    # IndexedDB read/write layer
  reconciler/     # Core reconciliation engine
  store/          # Zustand state stores
  types/          # Shared TypeScript interfaces and types
  utils/          # Pure utility functions
```

## Key Patterns

- **Parsers run on the main thread** — pdfjs spawns its own worker internally. Do not wrap parsers in an outer Web Worker (this broke production builds previously).
- **CSS tokens** — all colors/surfaces go through CSS custom properties defined in `index.css`. Never use raw hex values in components.
- **Changelog** — lives in `src/data/changelog.ts`. Keep entries user-facing and non-technical.
- **Build output** — `npm run build` produces `dist/Reconciler-v{version}.html` (versioned single-file).
- **Zero-warning lint** — `eslint --max-warnings=0` is enforced. Fix warnings, don't suppress them.

## Release Process

Every version bump requires these steps. The PWA (GitHub Pages) is only updated when the user explicitly requests it.

1. **Bump version** in `package.json` and add an entry to `src/data/changelog.ts`
2. **Build the packaged HTML**: `npm run build` → produces `dist/Reconciler-v{version}.html`
3. **Commit and push** to `main`
4. **Create a GitHub release** with the packaged HTML attached:
   ```bash
   gh release create v{version} dist/Reconciler-v{version}.html \
     --title "v{version} — {short description}" \
     --notes "{release notes matching the changelog entry}"
   ```
5. **PWA update (only if user requests it)**:
   ```bash
   SINGLE_FILE=0 GH_PAGES=1 npx vite build
   # then deploy dist/ contents to the gh-pages branch
   ```

The GitHub release is required — the in-app update checker fetches from `/releases/latest` and the download uses the release asset. Without a release, the update modal won't appear for users on older versions.

## Conventions

- Follow the global CLAUDE.md rules at `../.claude/CLAUDE.md`
- Imports: external → internal aliases → relative → styles
- Component files are PascalCase, utility files are camelCase
- All Zustand stores export a typed hook (e.g., `useReconcilerStore`)
- E2E selectors use `data-testid`, never CSS classes

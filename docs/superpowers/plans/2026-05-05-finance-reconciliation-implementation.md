# Finance Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-HTML React+TS app that ingests one monthly Paycom Excel + a folder of biweekly Paycom PDFs, recomputes per-(employee × project × week) billable hours under per-project OT thresholds, and produces on-screen views, branded PDF invoices, Excel/CSV exports, and JSON snapshots — deployable to GitHub Pages with service-worker auto-update.

**Architecture:** Mirrors `~/Codebase/Multitool` exactly: Vite + React 19 + TypeScript strict, Tailwind, Zustand, single-HTML build via `vite-plugin-singlefile`, deploy via adapted `deploy-pages.sh`. NO PWA manifest. Pure-function reconciler in `src/reconciler/`, web-worker parsers in `src/parsers/workers/`, IndexedDB persistence wrapper. UI is a side-nav SPA (no router lib — Zustand-driven `activePage`).

**Tech Stack:** React 19, TypeScript 5.7 strict, Vite 6, Tailwind 3.4, Zustand 5, TanStack Table v8, TanStack Virtual v3, pdfjs-dist 4, xlsx 0.18, exceljs 4, pdf-lib 1.17, lucide-react, marked (changelog), zod (schema validation), idb (IndexedDB wrapper), Vitest + React Testing Library, Playwright.

**Reference repo:** `/Users/noahgarrett/Codebase/Multitool` — copy configs, sw.js, UpdateModal, updateChecker, semver verbatim where applicable. Update strings: `multitool` → `reconciler`, `Multitool` → `Reconciler`, GitHub repo → `noahfgarrett/FinanceReconciliation`.

**Spec:** `docs/superpowers/specs/2026-05-05-finance-reconciliation-design.md`

---

## Phase Map

| # | Phase | Demoable result |
|---|---|---|
| 0 | Repo scaffold | `npm run dev` shows hello-world Tailwind page |
| 1 | Layout shell | Side nav with all 5 routes wired (placeholder pages) |
| 2 | Persistence | Theme + recent-imports persist across reloads (IndexedDB) |
| 3 | Sample data gate | Anonymized Excel + PDF committed to fixtures |
| 4 | Excel parser | Drop Excel → list of `ExcelRow[]` rendered on debug page |
| 5 | PDF parser | Drop PDF folder → list of `ParsedPdf[]` with weekly totals |
| 6 | Reconciler | Pure-function pipeline tested against fixtures |
| 7 | Billing Hours v1 | Drop zone + KPI strip + By Project view with real data |
| 8 | Spreadsheet view | Full TanStack Table with filters, sorts, group-by, flags |
| 9 | By Employee + By Week views | All four billing tabs functional |
| 10 | Projects + Clients pages | Edit thresholds/rates/aliases; mapping modal |
| 11 | History + Locking + Audit | Save / load / lock / clone / compare snapshots |
| 12 | Exports | PDF invoice, Excel report, JSON snapshot/settings |
| 13 | Settings + UX polish | Theme toggle, keyboard shortcuts, sample data, recent imports |
| 14 | Reconcile stub | Stub page with dropzone + "coming soon" |
| 15 | Service worker + Update modal + Deploy | GitHub Pages live with auto-update |
| 16 | Visual polish | `/frontend-design` + `/impeccable` passes |

Commit at the end of every task. Use Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`).

---

## Phase 0 — Repo & Toolchain Scaffold

**Goal:** `npm run dev` opens a Vite dev server showing a Tailwind-styled "hello" page; `npm run build` produces a single `dist/Reconciler.html`; type-check passes.

**Files to create at repo root:**
- `package.json`
- `vite.config.ts`
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- `tailwind.config.js`, `postcss.config.js`
- `.eslintrc.cjs`, `.prettierrc`
- `index.html`
- `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`

### Task 0.1 — Initialize npm project

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "lotusworks-reconciler",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build && mv dist/index.html dist/Reconciler.html",
    "preview": "vite preview",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc --noEmit -p tsconfig.app.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Install runtime deps with exact versions (per global CLAUDE.md npm supply chain rules)**

```bash
npm install --save-exact \
  react@19.0.0 react-dom@19.0.0 \
  zustand@5.0.3 \
  lucide-react@0.400.0 \
  marked@17.0.1 \
  pdfjs-dist@4.0.379 xlsx@0.18.5 exceljs@4.4.0 pdf-lib@1.17.1 \
  @tanstack/react-table@8.21.3 @tanstack/react-virtual@3.13.18 \
  zod@3.23.8 \
  idb@8.0.0
```

- [ ] **Step 3: Install dev deps with exact versions**

```bash
npm install --save-exact --save-dev \
  typescript@5.7.2 \
  vite@6.0.0 \
  @vitejs/plugin-react@4.3.4 \
  vite-plugin-singlefile@2.0.3 \
  tailwindcss@3.4.17 postcss@8.4.49 autoprefixer@10.4.20 \
  @types/react@19.0.0 @types/react-dom@19.0.0 \
  vitest@2.1.8 @testing-library/react@16.1.0 @testing-library/jest-dom@6.6.3 jsdom@25.0.1 \
  @playwright/test@1.58.2 \
  eslint@9.17.0 @eslint/js@9.17.0 typescript-eslint@8.18.0 \
  eslint-plugin-react-hooks@5.1.0 eslint-plugin-react-refresh@0.4.16 \
  prettier@3.4.2
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: scaffold package.json with pinned dependencies"
```

### Task 0.2 — TypeScript configs

- [ ] **Step 1: Write `tsconfig.json`** (verbatim from Multitool):

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 2: Write `tsconfig.app.json`** (verbatim from Multitool, paths kept):

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client", "vitest/globals"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `tsconfig.node.json`** (verbatim from Multitool — see `~/Codebase/Multitool/tsconfig.node.json`).

- [ ] **Step 4: Run typecheck on empty src — expect no errors**

```bash
mkdir -p src && echo 'export {}' > src/main.tsx
npm run typecheck
# expected: success, no output
```

- [ ] **Step 5: Commit**

```bash
git add tsconfig*.json src/main.tsx
git commit -m "chore: add TypeScript strict configs"
```

### Task 0.3 — Vite + Tailwind + PostCSS

- [ ] **Step 1: Write `vite.config.ts`** (mirror Multitool, change app version source):

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string }

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    rollupOptions: {
      output: { inlineDynamicImports: true, manualChunks: undefined },
    },
    chunkSizeWarningLimit: 10000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
})
```

- [ ] **Step 2: Write `tailwind.config.js`** — initial palette is a placeholder; Phase 16 (`/frontend-design`) replaces it. For now use spec values:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // LotusWorks brand
        'lw-orange': {
          DEFAULT: '#F97316',
          50: '#FFF7ED',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
        },
        'lw-blue': {
          DEFAULT: '#1E3A5F',
          800: '#1E3A5F',
          900: '#0A0F1C',
          950: '#020617',
        },
        slate: { 950: '#020617' }, // ensure 950 available
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Write `postcss.config.js`** (verbatim from Multitool):

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

- [ ] **Step 4: Write `src/index.css`**:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { @apply bg-slate-950 text-slate-100 font-sans antialiased; }
.dark body { @apply bg-slate-950 text-slate-100; }
.light body { @apply bg-slate-50 text-slate-900; }
```

- [ ] **Step 5: Write `index.html`**:

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LotusWorks Reconciler</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `src/main.tsx`**:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7: Write `src/vite-env.d.ts`**:

```ts
/// <reference types="vite/client" />
declare const __APP_VERSION__: string
```

- [ ] **Step 8: Write `src/App.tsx` (placeholder)**:

```tsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          LotusWorks Reconciler
        </h1>
        <p className="text-slate-400 mt-2">v{__APP_VERSION__}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Verify dev + build**

```bash
npm run dev
# expected: Vite server at http://localhost:5173 — page shows "LotusWorks Reconciler"
# Ctrl+C to stop
npm run build
# expected: dist/Reconciler.html exists, single file
ls -la dist/
```

- [ ] **Step 10: Commit**

```bash
git add vite.config.ts tailwind.config.js postcss.config.js index.html src/index.css src/main.tsx src/App.tsx src/vite-env.d.ts
git commit -m "feat: scaffold Vite+React+Tailwind single-HTML build"
```

### Task 0.4 — ESLint + Prettier + test setup

- [ ] **Step 1: Write `.eslintrc.cjs`** (flat config minimal):

```js
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-refresh'],
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
}
```

- [ ] **Step 2: Write `.prettierrc`**:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 3: Write `test/setup.ts`**:

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Run lint and typecheck — expect clean**

```bash
npm run lint
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add .eslintrc.cjs .prettierrc test/setup.ts
git commit -m "chore: add ESLint, Prettier, Vitest setup"
```

**Phase 0 smoke check:** dev server runs, build emits `dist/Reconciler.html`, lint + typecheck pass.

---

## Phase 1 — Layout Shell (side nav, theme provider, page routing)

**Goal:** Side nav with 5 routes (Billing Hours, Reconcile, Projects, Exports, History) and a Settings entry. Each route shows a placeholder page. Theme is `dark` (light mode wired but not yet toggleable). LotusWorks logo from `Assets/Hi Res LW-01.png` rendered in side-nav brand area.

**Files to create:**
- `src/types/index.ts` — shared TypeScript types
- `src/store/uiStore.ts` — Zustand UI slice (active page, theme, sidebar collapsed)
- `src/components/layout/AppShell.tsx`
- `src/components/layout/SideNav.tsx`
- `src/components/layout/PageHeader.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Badge.tsx`
- `src/pages/BillingHours/BillingHoursPage.tsx` (placeholder)
- `src/pages/Reconcile/ReconcilePage.tsx` (placeholder)
- `src/pages/Projects/ProjectsPage.tsx` (placeholder)
- `src/pages/Exports/ExportsPage.tsx` (placeholder)
- `src/pages/History/HistoryPage.tsx` (placeholder)
- `src/pages/Settings/SettingsPage.tsx` (placeholder)
- `public/lotusworks-logo.png` (copy of `Assets/Hi Res LW-01.png`)

### Task 1.1 — Shared types

- [ ] **Step 1: Write `src/types/index.ts`** with the page enum and re-exports as the surface grows:

```ts
export type PageId =
  | 'billing-hours'
  | 'reconcile'
  | 'projects'
  | 'exports'
  | 'history'
  | 'settings'

export type Theme = 'dark' | 'light'
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add PageId and Theme types"
```

### Task 1.2 — UI Zustand store

- [ ] **Step 1: Write `src/store/uiStore.ts`**:

```ts
import { create } from 'zustand'
import type { PageId, Theme } from '@/types'

interface UiState {
  activePage: PageId
  theme: Theme
  sidebarCollapsed: boolean
  setActivePage: (page: PageId) => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>((set) => ({
  activePage: 'billing-hours',
  theme: 'dark',
  sidebarCollapsed: false,
  setActivePage: (activePage) => set({ activePage }),
  setTheme: (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
    set({ theme })
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
```

- [ ] **Step 2: Write test `src/store/uiStore.test.ts`**:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useUiStore } from './uiStore'

beforeEach(() => {
  useUiStore.setState({ activePage: 'billing-hours', theme: 'dark', sidebarCollapsed: false })
})

describe('uiStore', () => {
  it('changes active page', () => {
    useUiStore.getState().setActivePage('projects')
    expect(useUiStore.getState().activePage).toBe('projects')
  })

  it('toggles sidebar', () => {
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })

  it('updates theme and applies dark class', () => {
    useUiStore.getState().setTheme('light')
    expect(useUiStore.getState().theme).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/store/uiStore.test.ts
# expected: 3 passed
```

- [ ] **Step 4: Commit**

```bash
git add src/store/uiStore.ts src/store/uiStore.test.ts
git commit -m "feat: add UI store for navigation and theme"
```

### Task 1.3 — Logo asset + UI primitives

- [ ] **Step 1: Copy logo to public/**

```bash
mkdir -p public && cp "Assets/Hi Res LW-01.png" public/lotusworks-logo.png
```

- [ ] **Step 2: Write `src/components/ui/Button.tsx`**:

```tsx
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-lw-orange-500 hover:bg-lw-orange-600 text-white shadow-[0_4px_14px_rgba(249,115,22,0.3)]',
  secondary: 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800',
  ghost: 'bg-transparent hover:bg-slate-900 text-slate-300',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
}

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, children, className = '', ...rest }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
```

- [ ] **Step 3: Write `src/components/ui/Badge.tsx`**:

```tsx
import type { ReactNode } from 'react'

type Tone = 'gray' | 'orange' | 'blue' | 'green' | 'amber' | 'red'

const TONES: Record<Tone, string> = {
  gray: 'bg-slate-800 text-slate-300 border-slate-700',
  orange: 'bg-lw-orange-500/15 text-lw-orange-400 border-lw-orange-500/30',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add public/lotusworks-logo.png src/components/ui/Button.tsx src/components/ui/Badge.tsx
git commit -m "feat: add Button, Badge primitives, copy logo"
```

### Task 1.4 — Side nav

- [ ] **Step 1: Write `src/components/layout/SideNav.tsx`**:

```tsx
import { BarChart3, GitCompareArrows, Boxes, Download, History, Settings } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import type { PageId } from '@/types'

interface NavItem {
  id: PageId
  label: string
  icon: typeof BarChart3
  group: 'Workspace' | 'Configuration' | 'Output' | 'History'
}

const ITEMS: NavItem[] = [
  { id: 'billing-hours', label: 'Billing Hours', icon: BarChart3, group: 'Workspace' },
  { id: 'reconcile', label: 'Reconcile', icon: GitCompareArrows, group: 'Workspace' },
  { id: 'projects', label: 'Projects', icon: Boxes, group: 'Configuration' },
  { id: 'exports', label: 'Exports', icon: Download, group: 'Output' },
  { id: 'history', label: 'Snapshots', icon: History, group: 'History' },
]

const GROUPS: Array<NavItem['group']> = ['Workspace', 'Configuration', 'Output', 'History']

export function SideNav() {
  const activePage = useUiStore((s) => s.activePage)
  const setActivePage = useUiStore((s) => s.setActivePage)

  return (
    <aside className="w-60 shrink-0 bg-[#0a0f1c] border-r border-slate-800 flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b border-slate-800 flex items-center gap-3">
        <img
          src="/lotusworks-logo.png"
          alt="LotusWorks"
          className="w-8 h-8 rounded-lg object-contain bg-slate-900 p-1"
        />
        <div className="leading-tight">
          <div className="font-semibold text-slate-100 text-sm">LotusWorks</div>
          <div className="text-xs text-slate-500">Reconciler</div>
        </div>
      </div>

      <nav className="flex-1 py-3">
        {GROUPS.map((group) => {
          const items = ITEMS.filter((i) => i.group === group)
          if (!items.length) return null
          return (
            <div key={group} className="px-3 mb-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold px-3 pb-2">
                {group}
              </div>
              {items.map((item) => {
                const Icon = item.icon
                const isActive = activePage === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className={`relative w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors mb-0.5 ${
                      isActive
                        ? 'bg-lw-orange-500/10 text-lw-orange-400'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-lw-orange-500 rounded-r" />
                    )}
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <button
          onClick={() => useUiStore.getState().setActivePage('settings')}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <div className="flex items-center gap-2 px-3 py-2 mt-2 text-xs text-slate-500">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
          v{__APP_VERSION__} · up to date
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/SideNav.tsx
git commit -m "feat: add side navigation with grouped routes"
```

### Task 1.5 — App shell + placeholder pages

- [ ] **Step 1: Write each placeholder page** (one per route — same template):

`src/pages/BillingHours/BillingHoursPage.tsx`:

```tsx
import { PageHeader } from '@/components/layout/PageHeader'
export default function BillingHoursPage() {
  return (
    <div>
      <PageHeader title="Billing Hours" subtitle="Drop your monthly Excel + PDF folder to begin" />
      <div className="p-8 text-slate-500">Drop zone goes here in Phase 7.</div>
    </div>
  )
}
```

Repeat with title/subtitle changes for: `Reconcile/ReconcilePage.tsx`, `Projects/ProjectsPage.tsx`, `Exports/ExportsPage.tsx`, `History/HistoryPage.tsx`, `Settings/SettingsPage.tsx`. Each default-exports its component.

- [ ] **Step 2: Write `src/components/layout/PageHeader.tsx`**:

```tsx
import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="px-8 py-7 flex items-start justify-between border-b border-slate-800/60">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
```

- [ ] **Step 3: Write `src/components/layout/AppShell.tsx`**:

```tsx
import { lazy, Suspense } from 'react'
import { SideNav } from './SideNav'
import { useUiStore } from '@/store/uiStore'
import type { PageId } from '@/types'

const PAGES: Record<PageId, React.LazyExoticComponent<React.ComponentType>> = {
  'billing-hours': lazy(() => import('@/pages/BillingHours/BillingHoursPage')),
  reconcile: lazy(() => import('@/pages/Reconcile/ReconcilePage')),
  projects: lazy(() => import('@/pages/Projects/ProjectsPage')),
  exports: lazy(() => import('@/pages/Exports/ExportsPage')),
  history: lazy(() => import('@/pages/History/HistoryPage')),
  settings: lazy(() => import('@/pages/Settings/SettingsPage')),
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] text-slate-600 text-sm">
      Loading…
    </div>
  )
}

export function AppShell() {
  const activePage = useUiStore((s) => s.activePage)
  const Page = PAGES[activePage]
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <SideNav />
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<PageFallback />}>
          <Page />
        </Suspense>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Replace `src/App.tsx`**:

```tsx
import { AppShell } from '@/components/layout/AppShell'

export default function App() {
  return <AppShell />
}
```

- [ ] **Step 5: Run dev server and click through each nav item — expect each to render**

```bash
npm run dev
# manual: visit http://localhost:5173, click each nav item, verify title changes
```

- [ ] **Step 6: Commit**

```bash
git add src/components/layout src/pages src/App.tsx
git commit -m "feat: layout shell with side-nav routing and placeholder pages"
```

**Phase 1 smoke check:** Side nav shows brand mark, all 5 main routes + Settings, clicking each renders a titled placeholder page. Active item gets orange accent.

---

## Phase 2 — Persistence (IndexedDB + JSON export)

**Goal:** UI state (active page is intentionally NOT persisted), theme, recent imports, project configs, and snapshots all survive a hard reload via IndexedDB. Foundation for snapshots/configs in later phases.

**Files to create:**
- `src/persistence/idb.ts` — typed wrapper around `idb` library
- `src/persistence/schemas.ts` — zod schemas for persisted state
- `src/persistence/migrations.ts` — schema version migrator
- `src/persistence/jsonExport.ts` — serialize/deserialize for JSON sync
- `src/persistence/idb.test.ts` — fake-indexeddb based tests
- Update `src/store/uiStore.ts` to hydrate theme on init

### Task 2.1 — IndexedDB wrapper

- [ ] **Step 1: Install fake-indexeddb for tests**

```bash
npm install --save-exact --save-dev fake-indexeddb@6.0.0
```

- [ ] **Step 2: Write `src/persistence/idb.ts`**:

```ts
import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'reconciler'
const DB_VERSION = 1

interface DbSchema {
  kv: { key: string; value: unknown }
  snapshots: { key: string; value: unknown; indexes: { 'by-period': string } }
  configs: { key: string; value: unknown }
  clients: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<DbSchema>> | null = null

function getDb(): Promise<IDBPDatabase<DbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
        if (!db.objectStoreNames.contains('configs')) db.createObjectStore('configs')
        if (!db.objectStoreNames.contains('clients')) db.createObjectStore('clients')
        if (!db.objectStoreNames.contains('snapshots')) {
          const store = db.createObjectStore('snapshots')
          store.createIndex('by-period', 'periodLabel')
        }
      },
    })
  }
  return dbPromise
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  return (await db.get('kv', key)) as T | undefined
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('kv', value, key)
}

export async function kvDelete(key: string): Promise<void> {
  const db = await getDb()
  await db.delete('kv', key)
}

export async function getAll<T>(store: 'configs' | 'clients' | 'snapshots'): Promise<T[]> {
  const db = await getDb()
  return (await db.getAll(store)) as T[]
}

export async function putRecord(
  store: 'configs' | 'clients' | 'snapshots',
  key: string,
  value: unknown,
): Promise<void> {
  const db = await getDb()
  await db.put(store, value, key)
}

export async function deleteRecord(
  store: 'configs' | 'clients' | 'snapshots',
  key: string,
): Promise<void> {
  const db = await getDb()
  await db.delete(store, key)
}

export async function clearAll(): Promise<void> {
  const db = await getDb()
  await Promise.all([
    db.clear('kv'),
    db.clear('configs'),
    db.clear('clients'),
    db.clear('snapshots'),
  ])
}

export function _resetDbForTests(): void {
  dbPromise = null
}
```

- [ ] **Step 3: Write `src/persistence/idb.test.ts`**:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { kvGet, kvSet, kvDelete, putRecord, getAll, clearAll, _resetDbForTests } from './idb'

beforeEach(async () => {
  _resetDbForTests()
  // fake-indexeddb is fresh per import; use clearAll for safety in repeat runs
})

describe('idb', () => {
  it('round-trips values via kv', async () => {
    await kvSet('theme', 'dark')
    expect(await kvGet<string>('theme')).toBe('dark')
  })

  it('deletes kv values', async () => {
    await kvSet('x', 1)
    await kvDelete('x')
    expect(await kvGet('x')).toBeUndefined()
  })

  it('stores and lists records in a typed store', async () => {
    await putRecord('configs', 'project-a', { name: 'Project A', threshold: 40 })
    await putRecord('configs', 'project-b', { name: 'Project B', threshold: 50 })
    const all = await getAll<{ name: string; threshold: number }>('configs')
    expect(all).toHaveLength(2)
    expect(all.map((c) => c.threshold).sort()).toEqual([40, 50])
  })

  it('clearAll wipes every store', async () => {
    await kvSet('y', 1)
    await putRecord('configs', 'k', { v: 1 })
    await clearAll()
    expect(await kvGet('y')).toBeUndefined()
    expect(await getAll('configs')).toHaveLength(0)
  })
})
```

- [ ] **Step 4: Run tests — expect 4 passed**

```bash
npm test -- src/persistence/idb.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/persistence/idb.ts src/persistence/idb.test.ts package.json package-lock.json
git commit -m "feat: typed IndexedDB wrapper with kv + records stores"
```

### Task 2.2 — Zod schemas + JSON export/import

- [ ] **Step 1: Write `src/persistence/schemas.ts`** (matches spec data model — types referenced in later phases use these as source of truth):

```ts
import { z } from 'zod'

export const ClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().optional(),
  contactEmail: z.string().optional(),
  paymentTerms: z.string().default('Net 30'),
  invoiceNumberPrefix: z.string().optional(),
  invoiceNumberCounter: z.number().int().nonnegative().default(0),
  remitTo: z.string().optional(),
  footerNotes: z.string().optional(),
})
export type Client = z.infer<typeof ClientSchema>

export const EmployeeRateOverrideSchema = z.object({
  regularRate: z.number().nonnegative().optional(),
  otRate: z.number().nonnegative().optional(),
  dtRate: z.number().nonnegative().optional(),
})
export type EmployeeRateOverride = z.infer<typeof EmployeeRateOverrideSchema>

export const ProjectConfigSchema = z.object({
  projectKey: z.string(),
  displayName: z.string(),
  clientId: z.string().optional(),
  poNumber: z.string().optional(),
  allocationAliases: z.array(z.string()).default([]),
  otThresholdHrs: z.number().min(1).max(168),
  includeDoubleTime: z.boolean().default(false),
  dtThresholdHrs: z.number().min(1).max(168).optional(),
  defaultRegularRate: z.number().nonnegative(),
  otRateOverride: z.number().nonnegative().optional(),
  dtRateOverride: z.number().nonnegative().optional(),
  employeeRateOverrides: z.record(z.string(), EmployeeRateOverrideSchema).default({}),
})
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>

export const FlagSchema = z.object({
  severity: z.enum(['info', 'warn', 'error']),
  code: z.enum([
    'unmatched-pdf',
    'missing-pdf',
    'project-not-configured',
    'excel-pdf-hours-mismatch',
    'high-ot-anomaly',
    'pdf-entry-missing-approval',
    'allocation-not-mapped',
    'parse-failure',
  ]),
  message: z.string(),
  context: z.record(z.unknown()).optional(),
})
export type RowFlag = z.infer<typeof FlagSchema>

export const WeeklyBillingSchema = z.object({
  employeeCode: z.string(),
  projectKey: z.string(),
  weekStart: z.string(),
  hours: z.number(),
  regularHrs: z.number(),
  otHrs: z.number(),
  dtHrs: z.number(),
  regularDollars: z.number(),
  otDollars: z.number(),
  dtDollars: z.number(),
  flags: z.array(FlagSchema).default([]),
  notes: z.string().optional(),
  reviewed: z.boolean().default(false),
})
export type WeeklyBilling = z.infer<typeof WeeklyBillingSchema>

export const AuditEventSchema = z.object({
  ts: z.string(),
  action: z.enum([
    'snapshot-created',
    'snapshot-locked',
    'snapshot-unlocked',
    'project-config-edited',
    'employee-rate-overridden',
    'invoice-generated',
    'flag-resolved',
    'manual-edit',
  ]),
  detail: z.string(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
})
export type AuditEvent = z.infer<typeof AuditEventSchema>

export const EmployeeSchema = z.object({
  code: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  wwid: z.string().optional(),
})
export type Employee = z.infer<typeof EmployeeSchema>

export const ExcelRowSchema = z.object({
  employeeCode: z.string(),
  laborAllocationDetails: z.string(),
  projectName: z.string(),
  regularHours: z.number(),
  overtimeHours: z.number(),
  doubleTimeHours: z.number(),
  dateUpdated: z.string(),
})
export type ExcelRow = z.infer<typeof ExcelRowSchema>

export const PdfTimesheetEntrySchema = z.object({
  date: z.string(),
  payCode: z.string(),
  allocation: z.string(),
  hoursTotal: z.number(),
  weekStart: z.string(),
})
export type PdfTimesheetEntry = z.infer<typeof PdfTimesheetEntrySchema>

export const ParsedPdfSchema = z.object({
  employeeCode: z.string(),
  employeeName: z.string(),
  payPeriodStart: z.string(),
  payPeriodEnd: z.string(),
  entries: z.array(PdfTimesheetEntrySchema),
  weeklyTotals: z.record(z.string(), z.number()),
  rawText: z.string(),
})
export type ParsedPdf = z.infer<typeof ParsedPdfSchema>

export const SnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  periodLabel: z.string(),
  createdAt: z.string(),
  lastModifiedAt: z.string(),
  locked: z.boolean().default(false),
  isDraft: z.boolean().default(false),
  employees: z.array(EmployeeSchema),
  excelRows: z.array(ExcelRowSchema),
  parsedPdfs: z.array(ParsedPdfSchema),
  projectConfigsAtSave: z.record(z.string(), ProjectConfigSchema),
  clientsAtSave: z.record(z.string(), ClientSchema),
  weeklyBilling: z.array(WeeklyBillingSchema),
  warnings: z.array(FlagSchema),
  auditLog: z.array(AuditEventSchema),
})
export type Snapshot = z.infer<typeof SnapshotSchema>

export const ExportBundleSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  appVersion: z.string(),
  scope: z.enum(['all', 'settings', 'history']),
  clients: z.record(z.string(), ClientSchema).optional(),
  projectConfigs: z.record(z.string(), ProjectConfigSchema).optional(),
  snapshots: z.array(SnapshotSchema).optional(),
})
export type ExportBundle = z.infer<typeof ExportBundleSchema>
```

- [ ] **Step 2: Write `src/persistence/migrations.ts`** (placeholder for now; future versions append handlers):

```ts
export function runMigrations(currentVersion: number): number {
  // Bump and add a case here when introducing a new schema version.
  // No migrations needed at v1.
  return currentVersion
}
```

- [ ] **Step 3: Write `src/persistence/jsonExport.ts`**:

```ts
import { ExportBundleSchema, type ExportBundle, type ProjectConfig, type Client, type Snapshot } from './schemas'

export interface ExportOptions {
  scope: 'all' | 'settings' | 'history'
  clients: Record<string, Client>
  projectConfigs: Record<string, ProjectConfig>
  snapshots: Snapshot[]
}

export function buildExportBundle(opts: ExportOptions): ExportBundle {
  const includeSettings = opts.scope === 'all' || opts.scope === 'settings'
  const includeHistory = opts.scope === 'all' || opts.scope === 'history'
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: __APP_VERSION__,
    scope: opts.scope,
    clients: includeSettings ? opts.clients : undefined,
    projectConfigs: includeSettings ? opts.projectConfigs : undefined,
    snapshots: includeHistory ? opts.snapshots : undefined,
  }
}

export function downloadJson(bundle: ExportBundle, filename: string): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function readJsonFile(file: File): Promise<ExportBundle> {
  const text = await file.text()
  const json: unknown = JSON.parse(text)
  return ExportBundleSchema.parse(json)
}
```

- [ ] **Step 4: Write `src/persistence/jsonExport.test.ts`**:

```ts
import { describe, it, expect } from 'vitest'
import { buildExportBundle, readJsonFile } from './jsonExport'

describe('buildExportBundle', () => {
  const base = {
    clients: { c1: { id: 'c1', name: 'Acme', paymentTerms: 'Net 30', invoiceNumberCounter: 0 } },
    projectConfigs: {
      p1: {
        projectKey: 'p1',
        displayName: 'P1',
        allocationAliases: [],
        otThresholdHrs: 40,
        includeDoubleTime: false,
        defaultRegularRate: 100,
        employeeRateOverrides: {},
      },
    },
    snapshots: [],
  }

  it('scope=all includes everything', () => {
    const b = buildExportBundle({ ...base, scope: 'all' })
    expect(b.clients).toBeDefined()
    expect(b.projectConfigs).toBeDefined()
    expect(b.snapshots).toBeDefined()
  })

  it('scope=settings excludes snapshots', () => {
    const b = buildExportBundle({ ...base, scope: 'settings' })
    expect(b.snapshots).toBeUndefined()
    expect(b.projectConfigs).toBeDefined()
  })

  it('scope=history excludes settings', () => {
    const b = buildExportBundle({ ...base, scope: 'history' })
    expect(b.clients).toBeUndefined()
    expect(b.snapshots).toBeDefined()
  })
})

describe('readJsonFile', () => {
  it('parses a valid bundle', async () => {
    const bundle = {
      schemaVersion: 1,
      exportedAt: '2026-05-05T00:00:00Z',
      appVersion: '0.1.0',
      scope: 'settings',
      clients: {},
      projectConfigs: {},
    }
    const file = new File([JSON.stringify(bundle)], 'bundle.json', { type: 'application/json' })
    const parsed = await readJsonFile(file)
    expect(parsed.scope).toBe('settings')
  })

  it('rejects an invalid bundle', async () => {
    const file = new File([JSON.stringify({ wrong: true })], 'bad.json')
    await expect(readJsonFile(file)).rejects.toThrow()
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npm test -- src/persistence/jsonExport.test.ts src/persistence/idb.test.ts
# expected: 9 passed
```

- [ ] **Step 6: Commit**

```bash
git add src/persistence/schemas.ts src/persistence/migrations.ts src/persistence/jsonExport.ts src/persistence/jsonExport.test.ts
git commit -m "feat: zod schemas and JSON export/import bundle"
```

### Task 2.3 — Hydrate UI store from IndexedDB

- [ ] **Step 1: Update `src/store/uiStore.ts` to hydrate theme on first call**:

```ts
import { create } from 'zustand'
import type { PageId, Theme } from '@/types'
import { kvGet, kvSet } from '@/persistence/idb'

const THEME_KEY = 'ui:theme'

interface UiState {
  activePage: PageId
  theme: Theme
  sidebarCollapsed: boolean
  setActivePage: (page: PageId) => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  hydrate: () => Promise<void>
}

function applyThemeClass(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
}

export const useUiStore = create<UiState>((set) => ({
  activePage: 'billing-hours',
  theme: 'dark',
  sidebarCollapsed: false,
  setActivePage: (activePage) => set({ activePage }),
  setTheme: (theme) => {
    applyThemeClass(theme)
    void kvSet(THEME_KEY, theme)
    set({ theme })
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  hydrate: async () => {
    const stored = await kvGet<Theme>(THEME_KEY)
    if (stored === 'dark' || stored === 'light') {
      applyThemeClass(stored)
      set({ theme: stored })
    } else {
      applyThemeClass('dark')
    }
  },
}))
```

- [ ] **Step 2: Hydrate on mount in `src/App.tsx`**:

```tsx
import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useUiStore } from '@/store/uiStore'

export default function App() {
  const hydrate = useUiStore((s) => s.hydrate)
  useEffect(() => {
    void hydrate()
  }, [hydrate])
  return <AppShell />
}
```

- [ ] **Step 3: Smoke test — toggle theme manually in dev tools console, reload, verify it persists**

```bash
npm run dev
# in browser console: useUiStore.getState().setTheme('light'); location.reload()
# expected: light class still applied after reload
```

- [ ] **Step 4: Commit**

```bash
git add src/store/uiStore.ts src/App.tsx
git commit -m "feat: hydrate theme from IndexedDB on app boot"
```

**Phase 2 smoke check:** Theme persists across reload. `idb` and `jsonExport` tests pass.

---

## Phase 3 — Sample Data Acquisition (USER GATE)

**Goal:** Have an anonymized real Excel + at least one anonymized PDF committed to `test/fixtures/` before locking parser strategy.

### Task 3.1 — Acquire and anonymize sample inputs

- [ ] **Step 1: Pause and request samples from the user.** The plan executor MUST stop here and surface this message:

> "Phase 3 needs real anonymized samples. Please drop into `test/fixtures/`:
>
> 1. `sample-monthly.xlsx` — one real monthly Excel with employee names changed to fake names (employee codes can stay), all hours/projects intact.
> 2. `sample-noah-2000-period1.pdf` — one real Paycom PDF, name → fake, code → 2000.
> 3. (Optional) `sample-noah-2000-period2.pdf` — second biweekly PDF for the same employee.
>
> Don't proceed to Phase 4 until both files exist."

- [ ] **Step 2: Once samples are committed, verify file presence:**

```bash
ls -la test/fixtures/sample-monthly.xlsx test/fixtures/sample-noah-2000-period1.pdf
```

- [ ] **Step 3: Commit fixtures**

```bash
git add test/fixtures/
git commit -m "test: add anonymized Excel and PDF fixtures"
```

**Phase 3 gate:** Fixtures committed. Without them, Phases 4 and 5 are guesses.

---

## Phase 4 — Excel Parser

**Goal:** Drop an Excel file → debug page renders the parsed `ExcelRow[]` and deduped `Employee[]`.

**Files:**
- `src/parsers/excelParser.ts` — pure function, parses an `ArrayBuffer` to `{ rows, employees, warnings }`
- `src/parsers/columnMatching.ts` — header-name fuzzy match (handles "Project Name Desc-Delete" variations)
- `src/parsers/workers/excel.worker.ts` — worker entry point that wraps the parser
- `src/parsers/excelParser.test.ts` — fixture-based tests
- `src/pages/__debug__/ParsersDebug.tsx` — temporary debug page (deleted at end of Phase 6)

### Task 4.1 — Header matching helper

- [ ] **Step 1: Write `src/parsers/columnMatching.ts`**:

```ts
const NORMALIZE = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '')

interface ColumnSpec {
  key: string
  patterns: string[] // patterns are normalized for comparison
}

export const EXCEL_COLUMNS: ColumnSpec[] = [
  { key: 'employeeCode', patterns: ['employeecode'] },
  { key: 'firstName', patterns: ['legalfirstname', 'firstname'] },
  { key: 'lastName', patterns: ['legallastname', 'lastname'] },
  { key: 'regularHours', patterns: ['regularhours'] },
  { key: 'overtimeHours', patterns: ['overtimehours', 'othours'] },
  { key: 'doubleTimeHours', patterns: ['doubletimehours', 'dthours'] },
  { key: 'dateUpdated', patterns: ['dateupdated', 'date'] },
  { key: 'wwid', patterns: ['wwid'] },
  { key: 'laborAllocationDetails', patterns: ['laborallocationdetails', 'allocation'] },
  { key: 'projectName', patterns: ['projectnamedescdelete', 'projectname', 'projectdescription'] },
]

export function matchHeaders(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((h, idx) => {
    const norm = NORMALIZE(h ?? '')
    for (const col of EXCEL_COLUMNS) {
      if (col.patterns.some((p) => norm === p || norm.includes(p))) {
        if (map[col.key] === undefined) map[col.key] = idx
      }
    }
  })
  return map
}

export function missingRequiredColumns(map: Record<string, number>): string[] {
  const required = ['employeeCode', 'firstName', 'lastName', 'regularHours', 'projectName']
  return required.filter((k) => map[k] === undefined)
}
```

- [ ] **Step 2: Write `src/parsers/columnMatching.test.ts`**:

```ts
import { describe, it, expect } from 'vitest'
import { matchHeaders, missingRequiredColumns } from './columnMatching'

describe('matchHeaders', () => {
  it('matches the spec header row', () => {
    const headers = [
      'Employee Code', 'Legal Firstname', 'Legal Lastname',
      'Regular Hours', 'Overtime Hours', 'Double Time Hours',
      'Date (Updated)', 'WWID', 'Labor Allocation Details', 'Project Name Desc-Delete',
    ]
    const map = matchHeaders(headers)
    expect(map.employeeCode).toBe(0)
    expect(map.firstName).toBe(1)
    expect(map.lastName).toBe(2)
    expect(map.regularHours).toBe(3)
    expect(map.overtimeHours).toBe(4)
    expect(map.doubleTimeHours).toBe(5)
    expect(map.dateUpdated).toBe(6)
    expect(map.projectName).toBe(9)
  })

  it('reports missing required columns', () => {
    const map = matchHeaders(['Foo', 'Bar'])
    const missing = missingRequiredColumns(map)
    expect(missing).toContain('employeeCode')
    expect(missing).toContain('projectName')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/parsers/columnMatching.test.ts
# expected: 2 passed
```

- [ ] **Step 4: Commit**

```bash
git add src/parsers/columnMatching.ts src/parsers/columnMatching.test.ts
git commit -m "feat: column header matcher for Excel parser"
```

### Task 4.2 — Excel parser core

- [ ] **Step 1: Write `src/parsers/excelParser.ts`**:

```ts
import * as XLSX from 'xlsx'
import { matchHeaders, missingRequiredColumns } from './columnMatching'
import type { Employee, ExcelRow, RowFlag } from '@/persistence/schemas'

export interface ExcelParseResult {
  rows: ExcelRow[]
  employees: Employee[]
  warnings: RowFlag[]
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.\-]/g, '')
    const n = parseFloat(cleaned)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function toExcelDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    // Excel serial → JS Date
    const epoch = Date.UTC(1899, 11, 30)
    const ms = epoch + v * 86400000
    return new Date(ms).toISOString().slice(0, 10)
  }
  if (typeof v === 'string' && v) return v
  return ''
}

export function parseExcel(buffer: ArrayBuffer): ExcelParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { rows: [], employees: [], warnings: [{ severity: 'error', code: 'parse-failure', message: 'Workbook has no sheets' }] }
  }
  const sheet = workbook.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' })
  if (!json.length) {
    return { rows: [], employees: [], warnings: [{ severity: 'error', code: 'parse-failure', message: 'Sheet is empty' }] }
  }

  const headerRow = (json[0] as unknown[]).map((c) => String(c ?? ''))
  const map = matchHeaders(headerRow)
  const missing = missingRequiredColumns(map)
  if (missing.length) {
    return {
      rows: [],
      employees: [],
      warnings: [
        {
          severity: 'error',
          code: 'parse-failure',
          message: `Missing required columns: ${missing.join(', ')}`,
          context: { foundHeaders: headerRow },
        },
      ],
    }
  }

  const rows: ExcelRow[] = []
  const empMap = new Map<string, Employee>()
  const warnings: RowFlag[] = []

  for (let i = 1; i < json.length; i++) {
    const r = json[i] as unknown[]
    const code = String(r[map.employeeCode] ?? '').trim()
    if (!code) continue

    const projectName = String(r[map.projectName] ?? '').trim()
    if (!projectName) {
      warnings.push({
        severity: 'warn',
        code: 'parse-failure',
        message: `Row ${i + 1}: missing project name`,
      })
      continue
    }

    rows.push({
      employeeCode: code,
      laborAllocationDetails: String(r[map.laborAllocationDetails] ?? '').trim(),
      projectName,
      regularHours: toNumber(r[map.regularHours]),
      overtimeHours: toNumber(r[map.overtimeHours]),
      doubleTimeHours: toNumber(r[map.doubleTimeHours]),
      dateUpdated: toExcelDate(r[map.dateUpdated]),
    })

    if (!empMap.has(code)) {
      empMap.set(code, {
        code,
        firstName: String(r[map.firstName] ?? '').trim(),
        lastName: String(r[map.lastName] ?? '').trim(),
        wwid: map.wwid !== undefined ? String(r[map.wwid] ?? '').trim() || undefined : undefined,
      })
    }
  }

  return { rows, employees: Array.from(empMap.values()), warnings }
}
```

- [ ] **Step 2: Write `src/parsers/excelParser.test.ts`** using the real fixture:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseExcel } from './excelParser'

function loadFixture(name: string): ArrayBuffer {
  const buf = readFileSync(resolve(process.cwd(), 'test/fixtures', name))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

describe('parseExcel', () => {
  it('parses the sample monthly workbook', () => {
    const result = parseExcel(loadFixture('sample-monthly.xlsx'))
    expect(result.warnings.filter((w) => w.severity === 'error')).toHaveLength(0)
    expect(result.rows.length).toBeGreaterThan(0)
    expect(result.employees.length).toBeGreaterThan(0)
    for (const r of result.rows) {
      expect(r.employeeCode).toBeTruthy()
      expect(r.projectName).toBeTruthy()
      expect(r.regularHours).toBeGreaterThanOrEqual(0)
    }
  })

  it('emits a parse-failure when headers are missing', () => {
    // synth tiny workbook with wrong headers
    const XLSX = require('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([['Foo', 'Bar'], [1, 2]])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws)
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const result = parseExcel(buf)
    expect(result.warnings[0].code).toBe('parse-failure')
  })
})
```

- [ ] **Step 3: Run tests against the real fixture**

```bash
npm test -- src/parsers/excelParser.test.ts
# expected: 2 passed (assumes Phase 3 fixture exists)
```

- [ ] **Step 4: Commit**

```bash
git add src/parsers/excelParser.ts src/parsers/excelParser.test.ts
git commit -m "feat: Excel parser with header matching and date coercion"
```

### Task 4.3 — Worker wrapper + debug page

- [ ] **Step 1: Write `src/parsers/workers/excel.worker.ts`**:

```ts
import { parseExcel } from '@/parsers/excelParser'

self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  try {
    const result = parseExcel(e.data)
    self.postMessage({ ok: true, result })
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
```

- [ ] **Step 2: Write `src/parsers/runExcelInWorker.ts`**:

```ts
import type { ExcelParseResult } from './excelParser'

export function runExcelInWorker(buffer: ArrayBuffer): Promise<ExcelParseResult> {
  return new Promise((resolveP, rejectP) => {
    const worker = new Worker(new URL('./workers/excel.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ ok: boolean; result?: ExcelParseResult; error?: string }>) => {
      worker.terminate()
      if (e.data.ok && e.data.result) resolveP(e.data.result)
      else rejectP(new Error(e.data.error ?? 'Unknown worker error'))
    }
    worker.onerror = (err) => {
      worker.terminate()
      rejectP(err.error ?? new Error('Worker error'))
    }
    worker.postMessage(buffer, [buffer])
  })
}
```

- [ ] **Step 3: Write debug page `src/pages/__debug__/ParsersDebug.tsx`** to drop a file and render output:

```tsx
import { useState } from 'react'
import { runExcelInWorker } from '@/parsers/runExcelInWorker'
import type { ExcelParseResult } from '@/parsers/excelParser'

export default function ParsersDebug() {
  const [result, setResult] = useState<ExcelParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    try {
      const buf = await f.arrayBuffer()
      setResult(await runExcelInWorker(buf))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="p-8 space-y-4 text-slate-200">
      <h1 className="text-xl font-semibold">Parsers Debug (temp)</h1>
      <input type="file" accept=".xlsx" onChange={onFile} className="text-sm" />
      {error && <pre className="text-red-400 text-xs">{error}</pre>}
      {result && (
        <>
          <div className="text-sm">Rows: {result.rows.length} · Employees: {result.employees.length} · Warnings: {result.warnings.length}</div>
          <pre className="text-xs bg-slate-900 p-3 rounded max-h-96 overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire debug page into AppShell** (TEMP — remove at end of Phase 6). Add to `src/types/index.ts` PageId: `| 'debug-parsers'`, add a side-nav item "Debug" gated to `import.meta.env.DEV`, register in `AppShell.tsx`.

- [ ] **Step 5: Smoke test — `npm run dev`, navigate to Debug, drop the fixture Excel, verify rendered output looks correct.**

- [ ] **Step 6: Commit**

```bash
git add src/parsers/workers/excel.worker.ts src/parsers/runExcelInWorker.ts src/pages/__debug__ src/types/index.ts src/components/layout/SideNav.tsx src/components/layout/AppShell.tsx
git commit -m "feat: web-worker Excel parser with debug drop page (dev-only)"
```

**Phase 4 smoke check:** Dropping the sample Excel into the Debug page lists rows + employees in JSON. No errors. Tests green.

---

## Phase 5 — PDF Parser

**Goal:** Drop a folder of PDFs → debug page renders `ParsedPdf[]` with weekly totals correctly grouped.

**Files:**
- `src/parsers/pdfParser.ts` — extract header (employee code/name + period) and table rows
- `src/parsers/dateUtils.ts` — ISO Monday-of-week helper
- `src/parsers/workers/pdf.worker.ts`
- `src/parsers/runPdfInWorker.ts`
- `src/parsers/pdfParser.test.ts`

### Task 5.1 — Date util (ISO Monday)

- [ ] **Step 1: Write `src/parsers/dateUtils.ts`**:

```ts
/** Returns the ISO Monday of the week containing the given date (UTC). */
export function isoMonday(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00Z' : ''))
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ...
  const offset = day === 0 ? -6 : 1 - day
  const monday = new Date(d.getTime() + offset * 86400000)
  return monday.toISOString().slice(0, 10)
}
```

- [ ] **Step 2: Write `src/parsers/dateUtils.test.ts`**:

```ts
import { describe, it, expect } from 'vitest'
import { isoMonday } from './dateUtils'

describe('isoMonday', () => {
  it('returns the same date for a Monday', () => {
    expect(isoMonday('2026-04-06')).toBe('2026-04-06')
  })
  it('returns the prior Monday for a Wednesday', () => {
    expect(isoMonday('2026-04-08')).toBe('2026-04-06')
  })
  it('handles Sundays correctly', () => {
    expect(isoMonday('2026-04-12')).toBe('2026-04-06')
  })
  it('handles year boundaries', () => {
    expect(isoMonday('2026-01-01')).toBe('2025-12-29')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/parsers/dateUtils.test.ts
# expected: 4 passed
```

- [ ] **Step 4: Commit**

```bash
git add src/parsers/dateUtils.ts src/parsers/dateUtils.test.ts
git commit -m "feat: ISO Monday helper for week grouping"
```

### Task 5.2 — PDF parser core

> **Note for executor:** the table-extraction strategy below is column-anchor-based. Inspect the actual sample PDF first; if the layout differs from `Date | Pay Code | IN | OUT | Allocation | Tax Profile | Missing | Comments | Dollars | Total Hrs. | Total Hrs./Day | Employee Approval | Supervisor Approval`, adjust `COLUMN_KEYWORDS` and the row-walker. Don't change the public function signature — the worker and reconciler depend on it.

- [ ] **Step 1: Configure pdfjs worker. Write `src/parsers/pdfjsConfig.ts`**:

```ts
import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
export { pdfjs }
```

- [ ] **Step 2: Write `src/parsers/pdfParser.ts`**:

```ts
import { pdfjs } from './pdfjsConfig'
import { isoMonday } from './dateUtils'
import type { ParsedPdf, PdfTimesheetEntry, RowFlag } from '@/persistence/schemas'

export interface PdfParseResult {
  parsed: ParsedPdf | null
  warnings: RowFlag[]
}

const HEADER_RE = /Employee:\s*(.+?)\s+(\d{2,6})\b/i
const PERIOD_RE = /(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/

const COLUMN_KEYWORDS = ['Date', 'Pay Code', 'IN', 'OUT', 'Allocation', 'Total Hrs']

function mmddyyyyToIso(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return ''
  const [, mm, dd, yyyy] = m
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

interface TextItem {
  str: string
  x: number
  y: number
}

async function extractTextItems(buffer: ArrayBuffer): Promise<TextItem[]> {
  const doc = await pdfjs.getDocument({ data: buffer }).promise
  const items: TextItem[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    for (const it of tc.items as Array<{ str: string; transform: number[] }>) {
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5] })
    }
  }
  return items
}

function joinByLine(items: TextItem[]): Array<{ y: number; texts: TextItem[] }> {
  // Group within ±1pt y
  const lines: Array<{ y: number; texts: TextItem[] }> = []
  for (const it of items) {
    const existing = lines.find((l) => Math.abs(l.y - it.y) < 1)
    if (existing) existing.texts.push(it)
    else lines.push({ y: it.y, texts: [it] })
  }
  // sort lines top-down (pdf coords y descending)
  lines.sort((a, b) => b.y - a.y)
  // sort texts left-to-right within line
  lines.forEach((l) => l.texts.sort((a, b) => a.x - b.x))
  return lines
}

function findColumnAnchors(lines: Array<{ y: number; texts: TextItem[] }>): { y: number; cols: Record<string, number> } | null {
  for (const line of lines) {
    const lineText = line.texts.map((t) => t.str).join(' ')
    const matches = COLUMN_KEYWORDS.filter((k) => lineText.includes(k))
    if (matches.length >= 4) {
      const cols: Record<string, number> = {}
      for (const k of COLUMN_KEYWORDS) {
        const t = line.texts.find((tx) => tx.str.includes(k.split(' ')[0]))
        if (t) cols[k] = t.x
      }
      return { y: line.y, cols }
    }
  }
  return null
}

function pickColumn(line: { texts: TextItem[] }, x: number, tolerance = 30): string {
  const close = line.texts
    .filter((t) => Math.abs(t.x - x) <= tolerance)
    .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))
  return close[0]?.str.trim() ?? ''
}

export async function parsePdf(buffer: ArrayBuffer, fileName?: string): Promise<PdfParseResult> {
  const warnings: RowFlag[] = []
  let items: TextItem[]
  try {
    items = await extractTextItems(buffer)
  } catch (err) {
    return {
      parsed: null,
      warnings: [
        {
          severity: 'error',
          code: 'parse-failure',
          message: `${fileName ?? 'PDF'}: failed to read text — ${err instanceof Error ? err.message : 'unknown'}`,
        },
      ],
    }
  }
  const rawText = items.map((i) => i.str).join(' ')

  const headerMatch = rawText.match(HEADER_RE)
  if (!headerMatch) {
    warnings.push({
      severity: 'error',
      code: 'parse-failure',
      message: `${fileName ?? 'PDF'}: missing "Employee: <name> <code>" header`,
    })
    return { parsed: null, warnings }
  }
  const employeeName = headerMatch[1].trim()
  const employeeCode = headerMatch[2].trim()

  const periodMatch = rawText.match(PERIOD_RE)
  const payPeriodStart = periodMatch ? mmddyyyyToIso(periodMatch[1]) : ''
  const payPeriodEnd = periodMatch ? mmddyyyyToIso(periodMatch[2]) : ''

  const lines = joinByLine(items)
  const anchors = findColumnAnchors(lines)
  if (!anchors) {
    warnings.push({
      severity: 'error',
      code: 'parse-failure',
      message: `${fileName ?? 'PDF'}: could not locate timesheet column header row`,
    })
    return { parsed: null, warnings }
  }

  const entries: PdfTimesheetEntry[] = []
  const dateRe = /^\d{1,2}\/\d{1,2}\/\d{4}$/
  for (const line of lines) {
    if (line.y >= anchors.y) continue // skip header and above
    const dateField = pickColumn(line, anchors.cols['Date'] ?? 0)
    if (!dateRe.test(dateField)) continue
    const isoDate = mmddyyyyToIso(dateField)
    if (!isoDate) continue
    const payCode = pickColumn(line, anchors.cols['Pay Code'] ?? 0)
    const allocation = pickColumn(line, anchors.cols['Allocation'] ?? 0)
    const totalRaw = pickColumn(line, anchors.cols['Total Hrs'] ?? 0)
    const hoursTotal = parseFloat(totalRaw.replace(/[^0-9.\-]/g, ''))
    if (!Number.isFinite(hoursTotal)) continue
    entries.push({
      date: isoDate,
      payCode: payCode || 'REG',
      allocation: allocation || 'UNALLOCATED',
      hoursTotal,
      weekStart: isoMonday(isoDate),
    })
  }

  const weeklyTotals: Record<string, number> = {}
  for (const e of entries) {
    weeklyTotals[e.weekStart] = (weeklyTotals[e.weekStart] ?? 0) + e.hoursTotal
  }

  if (!entries.length) {
    warnings.push({
      severity: 'warn',
      code: 'parse-failure',
      message: `${fileName ?? 'PDF'}: header parsed but no time entries found`,
      context: { employeeCode },
    })
  }

  return {
    parsed: {
      employeeCode,
      employeeName,
      payPeriodStart,
      payPeriodEnd,
      entries,
      weeklyTotals,
      rawText,
    },
    warnings,
  }
}
```

- [ ] **Step 3: Write `src/parsers/pdfParser.test.ts`** against the real fixture:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parsePdf } from './pdfParser'

function loadFixture(name: string): ArrayBuffer {
  const buf = readFileSync(resolve(process.cwd(), 'test/fixtures', name))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

describe('parsePdf', () => {
  it('extracts employee header and at least one entry from the sample PDF', async () => {
    const r = await parsePdf(loadFixture('sample-noah-2000-period1.pdf'), 'sample-noah-2000-period1.pdf')
    expect(r.parsed).not.toBeNull()
    expect(r.parsed!.employeeCode).toBe('2000')
    expect(r.parsed!.entries.length).toBeGreaterThan(0)
    expect(Object.keys(r.parsed!.weeklyTotals).length).toBeGreaterThan(0)
    for (const wkStart of Object.keys(r.parsed!.weeklyTotals)) {
      expect(wkStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('returns parse-failure when given a non-PDF buffer', async () => {
    const fake = new TextEncoder().encode('not a pdf').buffer
    const r = await parsePdf(fake, 'bad.pdf')
    expect(r.parsed).toBeNull()
    expect(r.warnings[0].code).toBe('parse-failure')
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/parsers/pdfParser.test.ts
# expected: 2 passed (assumes Phase 3 fixture exists)
# if 1st fails: inspect raw text, adjust COLUMN_KEYWORDS or anchor detection
```

- [ ] **Step 5: Commit**

```bash
git add src/parsers/pdfjsConfig.ts src/parsers/pdfParser.ts src/parsers/pdfParser.test.ts
git commit -m "feat: PDF timesheet parser with column-anchor table extraction"
```

### Task 5.3 — PDF worker + folder ingestion in debug page

- [ ] **Step 1: Write `src/parsers/workers/pdf.worker.ts`**:

```ts
import { parsePdf } from '@/parsers/pdfParser'

self.onmessage = async (e: MessageEvent<{ buffer: ArrayBuffer; fileName: string }>) => {
  const { buffer, fileName } = e.data
  const result = await parsePdf(buffer, fileName)
  self.postMessage({ ok: true, result })
}
```

- [ ] **Step 2: Write `src/parsers/runPdfInWorker.ts`** (concurrency-limited, max 4 workers in parallel):

```ts
import type { PdfParseResult } from './pdfParser'

const MAX_CONCURRENT = 4

export async function runPdfsInWorker(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<Array<{ fileName: string; result: PdfParseResult }>> {
  const results: Array<{ fileName: string; result: PdfParseResult }> = new Array(files.length)
  let next = 0
  let completed = 0

  async function runOne(idx: number): Promise<void> {
    const file = files[idx]
    const buffer = await file.arrayBuffer()
    const result = await new Promise<PdfParseResult>((resolveP, rejectP) => {
      const w = new Worker(new URL('./workers/pdf.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<{ ok: boolean; result: PdfParseResult }>) => {
        w.terminate()
        resolveP(e.data.result)
      }
      w.onerror = (err) => {
        w.terminate()
        rejectP(err.error ?? new Error('PDF worker failed'))
      }
      w.postMessage({ buffer, fileName: file.name }, [buffer])
    })
    results[idx] = { fileName: file.name, result }
    completed++
    onProgress?.(completed, files.length)
  }

  const workers: Promise<void>[] = []
  for (let i = 0; i < Math.min(MAX_CONCURRENT, files.length); i++) {
    workers.push(
      (async () => {
        while (next < files.length) {
          const my = next++
          await runOne(my)
        }
      })(),
    )
  }
  await Promise.all(workers)
  return results
}
```

- [ ] **Step 3: Extend the debug page** to accept a folder via `<input type="file" webkitdirectory>` and call `runPdfsInWorker`. Display per-file employeeCode + weeklyTotals.

```tsx
// add to ParsersDebug.tsx
import { runPdfsInWorker } from '@/parsers/runPdfInWorker'

// in component:
const [pdfResults, setPdfResults] = useState<Array<{ fileName: string; result: PdfParseResult }> | null>(null)
const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

async function onFolder(e: React.ChangeEvent<HTMLInputElement>) {
  const files = Array.from(e.target.files ?? []).filter((f) => f.name.toLowerCase().endsWith('.pdf'))
  if (!files.length) return
  setProgress({ done: 0, total: files.length })
  const out = await runPdfsInWorker(files, (done, total) => setProgress({ done, total }))
  setPdfResults(out)
  setProgress(null)
}

// JSX:
<input
  type="file"
  // @ts-expect-error webkitdirectory non-standard
  webkitdirectory=""
  multiple
  onChange={onFolder}
  className="text-sm"
/>
```

- [ ] **Step 4: Smoke test — drop the sample PDF folder. Verify employee codes match Excel codes.**

- [ ] **Step 5: Commit**

```bash
git add src/parsers/workers/pdf.worker.ts src/parsers/runPdfInWorker.ts src/pages/__debug__
git commit -m "feat: web-worker PDF parser with folder ingestion"
```

**Phase 5 smoke check:** Drop folder → all PDFs parse, weekly totals are non-empty for active employees, at least one entry per PDF.

---

## Phase 6 — Reconciler (pure functions)

**Goal:** Given parsed Excel + parsed PDFs + project configs, produce `WeeklyBilling[]` with flags. 100% pure, fully tested with golden fixtures.

**Files:**
- `src/reconciler/projectMatching.ts` — slug + alias resolution
- `src/reconciler/otCalculator.ts` — split a week's hours into reg/OT/DT
- `src/reconciler/flags.ts` — flag generators
- `src/reconciler/reconcile.ts` — main pipeline
- Tests for each

### Task 6.1 — projectKey slug + alias resolution

- [ ] **Step 1: Write `src/reconciler/projectMatching.ts`**:

```ts
import type { ProjectConfig, ExcelRow } from '@/persistence/schemas'

export function slugifyProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Given an allocation code (from PDF), find the matching projectKey.
 * Strategy: exact alias match → exact projectKey match → null.
 */
export function resolveAllocationToProjectKey(
  allocation: string,
  configs: Record<string, ProjectConfig>,
): string | null {
  const norm = allocation.trim().toLowerCase()
  for (const cfg of Object.values(configs)) {
    if (cfg.projectKey.toLowerCase() === norm) return cfg.projectKey
    if (cfg.allocationAliases.some((a) => a.trim().toLowerCase() === norm)) return cfg.projectKey
  }
  return null
}

/**
 * Build (employeeCode, projectKey) → projectName map from Excel rows
 * using the project's `laborAllocationDetails` as the authoritative alias.
 */
export function buildExcelAllocationMap(rows: ExcelRow[]): Map<string, { projectName: string; allocation: string }> {
  const m = new Map<string, { projectName: string; allocation: string }>()
  for (const r of rows) {
    const key = `${r.employeeCode}|${slugifyProjectName(r.projectName)}`
    if (!m.has(key)) m.set(key, { projectName: r.projectName, allocation: r.laborAllocationDetails })
  }
  return m
}
```

- [ ] **Step 2: Write tests** at `src/reconciler/projectMatching.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { slugifyProjectName, resolveAllocationToProjectKey } from './projectMatching'
import type { ProjectConfig } from '@/persistence/schemas'

const cfg = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
  projectKey: 'project-acme',
  displayName: 'Project Acme',
  allocationAliases: ['ACM-001'],
  otThresholdHrs: 40,
  includeDoubleTime: false,
  defaultRegularRate: 100,
  employeeRateOverrides: {},
  ...overrides,
})

describe('slugifyProjectName', () => {
  it('produces a slug', () => {
    expect(slugifyProjectName('Project Acme — Phase 2')).toBe('project-acme-phase-2')
  })
})

describe('resolveAllocationToProjectKey', () => {
  const configs: Record<string, ProjectConfig> = { 'project-acme': cfg() }

  it('matches by alias', () => {
    expect(resolveAllocationToProjectKey('ACM-001', configs)).toBe('project-acme')
  })
  it('matches by projectKey direct', () => {
    expect(resolveAllocationToProjectKey('project-acme', configs)).toBe('project-acme')
  })
  it('returns null when no match', () => {
    expect(resolveAllocationToProjectKey('UNKNOWN-XYZ', configs)).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests, commit**

```bash
npm test -- src/reconciler/projectMatching.test.ts
git add src/reconciler/projectMatching.ts src/reconciler/projectMatching.test.ts
git commit -m "feat: project slug + allocation alias resolution"
```

### Task 6.2 — OT calculator (per-week, isolated per project)

- [ ] **Step 1: Write `src/reconciler/otCalculator.ts`**:

```ts
import type { ProjectConfig } from '@/persistence/schemas'

export interface SplitHours {
  regularHrs: number
  otHrs: number
  dtHrs: number
}

export interface RateSet {
  regular: number
  ot: number
  dt: number
}

/**
 * Split a single week's hours on a single project per the project's thresholds.
 * Hours up to OT threshold = Regular.
 * Hours between OT and DT thresholds = OT.
 * Hours over DT threshold = DT (only when includeDoubleTime).
 */
export function splitWeekHours(hours: number, cfg: ProjectConfig): SplitHours {
  const ot = cfg.otThresholdHrs
  const dt = cfg.includeDoubleTime && cfg.dtThresholdHrs ? cfg.dtThresholdHrs : Infinity

  if (hours <= 0) return { regularHrs: 0, otHrs: 0, dtHrs: 0 }
  if (hours <= ot) return { regularHrs: hours, otHrs: 0, dtHrs: 0 }
  if (hours <= dt) return { regularHrs: ot, otHrs: hours - ot, dtHrs: 0 }
  return { regularHrs: ot, otHrs: dt - ot, dtHrs: hours - dt }
}

/**
 * Resolve effective rates: project-default → project override → employee override.
 */
export function resolveRates(
  cfg: ProjectConfig,
  employeeCode: string,
): RateSet {
  const projReg = cfg.defaultRegularRate
  const projOt = cfg.otRateOverride ?? projReg * 1.5
  const projDt = cfg.dtRateOverride ?? projReg * 2

  const emp = cfg.employeeRateOverrides[employeeCode]
  return {
    regular: emp?.regularRate ?? projReg,
    ot: emp?.otRate ?? projOt,
    dt: emp?.dtRate ?? projDt,
  }
}
```

- [ ] **Step 2: Write `src/reconciler/otCalculator.test.ts`**:

```ts
import { describe, it, expect } from 'vitest'
import { splitWeekHours, resolveRates } from './otCalculator'
import type { ProjectConfig } from '@/persistence/schemas'

const base: ProjectConfig = {
  projectKey: 'p',
  displayName: 'P',
  allocationAliases: [],
  otThresholdHrs: 40,
  includeDoubleTime: false,
  defaultRegularRate: 100,
  employeeRateOverrides: {},
}

describe('splitWeekHours', () => {
  it('returns all regular below threshold', () => {
    expect(splitWeekHours(35, base)).toEqual({ regularHrs: 35, otHrs: 0, dtHrs: 0 })
  })
  it('caps regular at threshold and overflow as OT', () => {
    expect(splitWeekHours(50, base)).toEqual({ regularHrs: 40, otHrs: 10, dtHrs: 0 })
  })
  it('handles 50hr threshold project', () => {
    expect(splitWeekHours(55, { ...base, otThresholdHrs: 50 })).toEqual({
      regularHrs: 50, otHrs: 5, dtHrs: 0,
    })
  })
  it('splits across reg/OT/DT when DT enabled', () => {
    const cfg: ProjectConfig = { ...base, otThresholdHrs: 40, includeDoubleTime: true, dtThresholdHrs: 50 }
    expect(splitWeekHours(60, cfg)).toEqual({ regularHrs: 40, otHrs: 10, dtHrs: 10 })
  })
  it('zero hours yields zero', () => {
    expect(splitWeekHours(0, base)).toEqual({ regularHrs: 0, otHrs: 0, dtHrs: 0 })
  })
})

describe('resolveRates', () => {
  it('uses 1.5× / 2× by default', () => {
    expect(resolveRates(base, 'X')).toEqual({ regular: 100, ot: 150, dt: 200 })
  })
  it('respects project overrides', () => {
    expect(resolveRates({ ...base, otRateOverride: 175, dtRateOverride: 220 }, 'X')).toEqual({
      regular: 100, ot: 175, dt: 220,
    })
  })
  it('respects employee overrides', () => {
    const cfg: ProjectConfig = {
      ...base,
      employeeRateOverrides: { '2000': { regularRate: 250, otRate: 400 } },
    }
    expect(resolveRates(cfg, '2000').regular).toBe(250)
    expect(resolveRates(cfg, '2000').ot).toBe(400)
    expect(resolveRates(cfg, '2000').dt).toBe(200) // falls through to project default
  })
})
```

- [ ] **Step 3: Run tests, commit**

```bash
npm test -- src/reconciler/otCalculator.test.ts
# expected: 8 passed
git add src/reconciler/otCalculator.ts src/reconciler/otCalculator.test.ts
git commit -m "feat: per-project OT calculator with rate resolution"
```

### Task 6.3 — Reconcile pipeline

- [ ] **Step 1: Write `src/reconciler/reconcile.ts`**:

```ts
import type {
  Employee, ExcelRow, ParsedPdf, ProjectConfig, RowFlag, WeeklyBilling,
} from '@/persistence/schemas'
import { resolveAllocationToProjectKey, slugifyProjectName } from './projectMatching'
import { splitWeekHours, resolveRates } from './otCalculator'

export interface ReconcileInput {
  employees: Employee[]
  excelRows: ExcelRow[]
  parsedPdfs: ParsedPdf[]
  projectConfigs: Record<string, ProjectConfig>
}

export interface ReconcileOutput {
  weeklyBilling: WeeklyBilling[]
  warnings: RowFlag[]
  unresolvedAllocations: string[] // surfaced for the project-mapping modal
}

const HOURS_TOLERANCE = 0.1
const HIGH_OT_RATIO = 2.0

export function reconcile(input: ReconcileInput): ReconcileOutput {
  const { employees, excelRows, parsedPdfs, projectConfigs } = input
  const warnings: RowFlag[] = []
  const billing: WeeklyBilling[] = []
  const unresolved = new Set<string>()

  const empMap = new Map(employees.map((e) => [e.code, e]))
  const excelByEmpProject = new Map<string, ExcelRow>()
  for (const row of excelRows) {
    const k = `${row.employeeCode}|${slugifyProjectName(row.projectName)}`
    excelByEmpProject.set(k, row)
  }

  // 1. unmatched-pdf flags
  for (const pdf of parsedPdfs) {
    if (!empMap.has(pdf.employeeCode)) {
      warnings.push({
        severity: 'warn',
        code: 'unmatched-pdf',
        message: `PDF for employee code ${pdf.employeeCode} (${pdf.employeeName}) does not appear in the Excel`,
        context: { employeeCode: pdf.employeeCode },
      })
    }
  }
  // missing-pdf flags
  const pdfCodes = new Set(parsedPdfs.map((p) => p.employeeCode))
  for (const e of employees) {
    if (!pdfCodes.has(e.code)) {
      warnings.push({
        severity: 'warn',
        code: 'missing-pdf',
        message: `No PDF found for ${e.firstName} ${e.lastName} (${e.code})`,
        context: { employeeCode: e.code },
      })
    }
  }

  // 2. Build (employee, project, week) totals from PDF entries.
  type Bucket = { hours: number; weekStart: string; employeeCode: string; projectKey: string }
  const buckets = new Map<string, Bucket>()

  for (const pdf of parsedPdfs) {
    if (!empMap.has(pdf.employeeCode)) continue
    for (const entry of pdf.entries) {
      const projectKey = resolveAllocationToProjectKey(entry.allocation, projectConfigs)
      if (!projectKey) {
        unresolved.add(entry.allocation)
        continue
      }
      const k = `${pdf.employeeCode}|${projectKey}|${entry.weekStart}`
      const existing = buckets.get(k)
      if (existing) existing.hours += entry.hoursTotal
      else buckets.set(k, { hours: entry.hoursTotal, weekStart: entry.weekStart, employeeCode: pdf.employeeCode, projectKey })
    }
  }

  // 3. Cross-check Excel monthly project totals vs PDF-derived sums
  const pdfProjectTotals = new Map<string, number>()
  for (const b of buckets.values()) {
    const k = `${b.employeeCode}|${b.projectKey}`
    pdfProjectTotals.set(k, (pdfProjectTotals.get(k) ?? 0) + b.hours)
  }
  for (const [k, row] of excelByEmpProject) {
    const cfg = Object.values(projectConfigs).find(
      (c) => slugifyProjectName(c.displayName) === slugifyProjectName(row.projectName),
    )
    if (!cfg) continue
    const pdfTotalKey = `${row.employeeCode}|${cfg.projectKey}`
    const pdfTotal = pdfProjectTotals.get(pdfTotalKey) ?? 0
    const excelTotal = row.regularHours + row.overtimeHours + row.doubleTimeHours
    if (Math.abs(pdfTotal - excelTotal) > HOURS_TOLERANCE) {
      warnings.push({
        severity: 'warn',
        code: 'excel-pdf-hours-mismatch',
        message: `${row.employeeCode} on ${row.projectName}: Excel total ${excelTotal.toFixed(2)} hr vs PDF total ${pdfTotal.toFixed(2)} hr`,
        context: { employeeCode: row.employeeCode, projectKey: cfg.projectKey, excelTotal, pdfTotal },
      })
    }
  }

  // 4. Apply OT thresholds + rates to produce WeeklyBilling rows
  for (const b of buckets.values()) {
    const cfg = projectConfigs[b.projectKey]
    if (!cfg) continue
    const split = splitWeekHours(b.hours, cfg)
    const rates = resolveRates(cfg, b.employeeCode)
    const flags: RowFlag[] = []
    if (split.otHrs > cfg.otThresholdHrs * (HIGH_OT_RATIO - 1)) {
      flags.push({
        severity: 'info',
        code: 'high-ot-anomaly',
        message: `OT ${split.otHrs.toFixed(1)}hr exceeds 200% of threshold (${cfg.otThresholdHrs}hr)`,
      })
    }
    billing.push({
      employeeCode: b.employeeCode,
      projectKey: b.projectKey,
      weekStart: b.weekStart,
      hours: b.hours,
      regularHrs: split.regularHrs,
      otHrs: split.otHrs,
      dtHrs: split.dtHrs,
      regularDollars: round2(split.regularHrs * rates.regular),
      otDollars: round2(split.otHrs * rates.ot),
      dtDollars: round2(split.dtHrs * rates.dt),
      flags,
      reviewed: false,
    })
  }

  // 5. allocation-not-mapped warnings
  for (const alloc of unresolved) {
    warnings.push({
      severity: 'error',
      code: 'allocation-not-mapped',
      message: `Allocation code "${alloc}" is not mapped to any project`,
      context: { allocation: alloc },
    })
  }

  // sort billing rows for stable output
  billing.sort(
    (a, b) =>
      a.employeeCode.localeCompare(b.employeeCode) ||
      a.projectKey.localeCompare(b.projectKey) ||
      a.weekStart.localeCompare(b.weekStart),
  )

  return { weeklyBilling: billing, warnings, unresolvedAllocations: Array.from(unresolved) }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
```

- [ ] **Step 2: Write `src/reconciler/reconcile.test.ts`** with hand-built fixtures (golden):

```ts
import { describe, it, expect } from 'vitest'
import { reconcile } from './reconcile'
import type { Employee, ExcelRow, ParsedPdf, ProjectConfig } from '@/persistence/schemas'

const emp = (code: string, first = 'X', last = 'Y'): Employee => ({ code, firstName: first, lastName: last })

const cfg = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
  projectKey: 'project-acme',
  displayName: 'Project Acme',
  allocationAliases: ['ACM'],
  otThresholdHrs: 40,
  includeDoubleTime: false,
  defaultRegularRate: 100,
  employeeRateOverrides: {},
  ...overrides,
})

const pdf = (
  code: string,
  weekStart: string,
  allocation: string,
  hours: number,
): ParsedPdf => ({
  employeeCode: code,
  employeeName: 'X Y',
  payPeriodStart: weekStart,
  payPeriodEnd: weekStart,
  entries: [{ date: weekStart, payCode: 'REG', allocation, hoursTotal: hours, weekStart }],
  weeklyTotals: { [weekStart]: hours },
  rawText: '',
})

const excel = (code: string, project: string, reg: number, ot = 0): ExcelRow => ({
  employeeCode: code,
  laborAllocationDetails: 'ACM',
  projectName: project,
  regularHours: reg,
  overtimeHours: ot,
  doubleTimeHours: 0,
  dateUpdated: '2026-04-30',
})

describe('reconcile', () => {
  it('produces a single weekly row with correct OT split and dollars', () => {
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', 'Project Acme', 50)],
      parsedPdfs: [pdf('2000', '2026-04-06', 'ACM', 50)],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.weeklyBilling).toHaveLength(1)
    const r = out.weeklyBilling[0]
    expect(r.regularHrs).toBe(40)
    expect(r.otHrs).toBe(10)
    expect(r.regularDollars).toBe(4000)
    expect(r.otDollars).toBe(1500)
    expect(r.dtDollars).toBe(0)
  })

  it('flags unmatched PDFs', () => {
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', 'Project Acme', 30)],
      parsedPdfs: [pdf('2000', '2026-04-06', 'ACM', 30), pdf('9999', '2026-04-06', 'ACM', 10)],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.warnings.some((w) => w.code === 'unmatched-pdf')).toBe(true)
  })

  it('flags allocations with no project config', () => {
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', 'Project Acme', 30)],
      parsedPdfs: [pdf('2000', '2026-04-06', 'XYZ-NO-MATCH', 30)],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.unresolvedAllocations).toContain('XYZ-NO-MATCH')
    expect(out.warnings.some((w) => w.code === 'allocation-not-mapped')).toBe(true)
  })

  it('flags excel-vs-pdf mismatches over 0.1hr', () => {
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', 'Project Acme', 30)],   // 30 reg + 0 OT + 0 DT = 30
      parsedPdfs: [pdf('2000', '2026-04-06', 'ACM', 25)], // PDF says 25
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.warnings.some((w) => w.code === 'excel-pdf-hours-mismatch')).toBe(true)
  })

  it('flags missing PDF', () => {
    const out = reconcile({
      employees: [emp('2000'), emp('3000')],
      excelRows: [excel('2000', 'Project Acme', 30), excel('3000', 'Project Acme', 20)],
      parsedPdfs: [pdf('2000', '2026-04-06', 'ACM', 30)],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.warnings.some((w) => w.code === 'missing-pdf')).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests, commit**

```bash
npm test -- src/reconciler/reconcile.test.ts
# expected: 5 passed
git add src/reconciler/reconcile.ts src/reconciler/reconcile.test.ts
git commit -m "feat: reconcile pipeline with flag generation"
```

### Task 6.4 — Remove debug page from Phase 4/5

- [ ] **Step 1: Delete `src/pages/__debug__/`**

```bash
rm -rf src/pages/__debug__
```

- [ ] **Step 2: Remove `'debug-parsers'` from `PageId` union and from `SideNav.tsx` and `AppShell.tsx`.**

- [ ] **Step 3: Run typecheck + lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove parsers debug page"
```

**Phase 6 smoke check:** `npm test` runs the entire suite green; reconcile tests cover OT calc, flags, and golden cases.

---

## Phase 7 — Billing Hours v1 (Drop zone + KPI strip + By Project)

**Goal:** Drop Excel + folder → app reconciles → page shows KPI strip + By Project table populated with real data.

**Files:**
- `src/store/snapshotStore.ts` — current snapshot, project configs, clients in memory; persisted via IndexedDB
- `src/store/projectStore.ts` (merged into snapshotStore for v1)
- `src/components/DropZone.tsx`
- `src/components/ImportFlow.tsx` — orchestrates Excel + PDF parse + reconcile
- `src/pages/BillingHours/KpiStrip.tsx`
- `src/pages/BillingHours/ByProjectView.tsx`
- `src/pages/BillingHours/BillingHoursPage.tsx` (replace placeholder)
- `src/lib/format.ts` — currency / number / hours formatters

### Task 7.1 — Format helpers

- [ ] **Step 1: Write `src/lib/format.ts`**:

```ts
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('en-US')

export const fmtUsd = (n: number): string => usd.format(n)
export const fmtUsdCents = (n: number): string => usdCents.format(n)
export const fmtHours = (n: number): string => `${num.format(Math.round(n * 100) / 100)} hr`
export const fmtNumber = (n: number): string => num.format(n)
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat: locale-aware formatters"
```

### Task 7.2 — Snapshot store

- [ ] **Step 1: Write `src/store/snapshotStore.ts`**:

```ts
import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { reconcile } from '@/reconciler/reconcile'
import type { Client, Employee, ExcelRow, ParsedPdf, ProjectConfig, RowFlag, Snapshot, WeeklyBilling, AuditEvent } from '@/persistence/schemas'
import { getAll, putRecord, deleteRecord, kvGet, kvSet } from '@/persistence/idb'
import { slugifyProjectName } from '@/reconciler/projectMatching'

const CURRENT_SNAPSHOT_ID = 'current-snapshot-id'

interface SnapshotState {
  current: Snapshot | null
  projectConfigs: Record<string, ProjectConfig>
  clients: Record<string, Client>
  snapshots: Snapshot[]
  unresolvedAllocations: string[]

  hydrate: () => Promise<void>
  importBatch: (input: { excelRows: ExcelRow[]; employees: Employee[]; parsedPdfs: ParsedPdf[]; periodLabel: string }) => Promise<void>
  upsertProjectConfig: (cfg: ProjectConfig) => Promise<void>
  upsertClient: (client: Client) => Promise<void>
  recompute: () => Promise<void>
  saveCurrentAsSnapshot: (name: string) => Promise<void>
  loadSnapshot: (id: string) => Promise<void>
  deleteSnapshot: (id: string) => Promise<void>
  duplicateSnapshot: (id: string, newName: string) => Promise<void>
  toggleLock: (id: string) => Promise<void>
  appendAudit: (action: AuditEvent['action'], detail: string, before?: unknown, after?: unknown) => void
}

function bootstrapProjectsFromExcel(excelRows: ExcelRow[], existing: Record<string, ProjectConfig>): Record<string, ProjectConfig> {
  const out = { ...existing }
  for (const r of excelRows) {
    const key = slugifyProjectName(r.projectName)
    if (!out[key]) {
      out[key] = {
        projectKey: key,
        displayName: r.projectName,
        allocationAliases: r.laborAllocationDetails ? [r.laborAllocationDetails] : [],
        otThresholdHrs: 40,
        includeDoubleTime: false,
        defaultRegularRate: 0,
        employeeRateOverrides: {},
      }
    } else if (r.laborAllocationDetails && !out[key].allocationAliases.includes(r.laborAllocationDetails)) {
      out[key] = { ...out[key], allocationAliases: [...out[key].allocationAliases, r.laborAllocationDetails] }
    }
  }
  return out
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  current: null,
  projectConfigs: {},
  clients: {},
  snapshots: [],
  unresolvedAllocations: [],

  hydrate: async () => {
    const [configs, clients, snapshots, currentId] = await Promise.all([
      getAll<ProjectConfig>('configs'),
      getAll<Client>('clients'),
      getAll<Snapshot>('snapshots'),
      kvGet<string>(CURRENT_SNAPSHOT_ID),
    ])
    const cfgMap: Record<string, ProjectConfig> = {}
    configs.forEach((c) => (cfgMap[c.projectKey] = c))
    const clientMap: Record<string, Client> = {}
    clients.forEach((c) => (clientMap[c.id] = c))
    const current = snapshots.find((s) => s.id === currentId) ?? null
    set({ projectConfigs: cfgMap, clients: clientMap, snapshots, current })
  },

  importBatch: async ({ excelRows, employees, parsedPdfs, periodLabel }) => {
    const updatedConfigs = bootstrapProjectsFromExcel(excelRows, get().projectConfigs)
    for (const cfg of Object.values(updatedConfigs)) {
      await putRecord('configs', cfg.projectKey, cfg)
    }

    const out = reconcile({
      employees,
      excelRows,
      parsedPdfs,
      projectConfigs: updatedConfigs,
    })
    const snap: Snapshot = {
      id: uuid(),
      name: `Draft (${periodLabel})`,
      periodLabel,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      locked: false,
      isDraft: true,
      employees,
      excelRows,
      parsedPdfs,
      projectConfigsAtSave: updatedConfigs,
      clientsAtSave: get().clients,
      weeklyBilling: out.weeklyBilling,
      warnings: out.warnings,
      auditLog: [{ ts: new Date().toISOString(), action: 'snapshot-created', detail: `Imported ${parsedPdfs.length} PDFs, ${excelRows.length} rows` }],
    }
    await putRecord('snapshots', snap.id, snap)
    await kvSet(CURRENT_SNAPSHOT_ID, snap.id)
    set({
      current: snap,
      projectConfigs: updatedConfigs,
      snapshots: [...get().snapshots.filter((s) => !s.isDraft), snap],
      unresolvedAllocations: out.unresolvedAllocations,
    })
  },

  upsertProjectConfig: async (cfg) => {
    await putRecord('configs', cfg.projectKey, cfg)
    set({ projectConfigs: { ...get().projectConfigs, [cfg.projectKey]: cfg } })
    await get().recompute()
  },

  upsertClient: async (c) => {
    await putRecord('clients', c.id, c)
    set({ clients: { ...get().clients, [c.id]: c } })
  },

  recompute: async () => {
    const cur = get().current
    if (!cur || cur.locked) return
    const out = reconcile({
      employees: cur.employees,
      excelRows: cur.excelRows,
      parsedPdfs: cur.parsedPdfs,
      projectConfigs: get().projectConfigs,
    })
    const updated: Snapshot = {
      ...cur,
      lastModifiedAt: new Date().toISOString(),
      projectConfigsAtSave: get().projectConfigs,
      clientsAtSave: get().clients,
      weeklyBilling: out.weeklyBilling,
      warnings: out.warnings,
    }
    await putRecord('snapshots', updated.id, updated)
    set({
      current: updated,
      snapshots: get().snapshots.map((s) => (s.id === updated.id ? updated : s)),
      unresolvedAllocations: out.unresolvedAllocations,
    })
  },

  saveCurrentAsSnapshot: async (name) => {
    const cur = get().current
    if (!cur) return
    const saved: Snapshot = {
      ...cur,
      id: uuid(),
      name,
      isDraft: false,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      auditLog: [...cur.auditLog, { ts: new Date().toISOString(), action: 'snapshot-created', detail: `Saved as "${name}"` }],
    }
    await putRecord('snapshots', saved.id, saved)
    await kvSet(CURRENT_SNAPSHOT_ID, saved.id)
    set({
      current: saved,
      snapshots: [...get().snapshots.filter((s) => s.id !== cur.id), saved],
    })
  },

  loadSnapshot: async (id) => {
    const snap = get().snapshots.find((s) => s.id === id)
    if (!snap) return
    await kvSet(CURRENT_SNAPSHOT_ID, id)
    set({ current: snap })
  },

  deleteSnapshot: async (id) => {
    await deleteRecord('snapshots', id)
    set({ snapshots: get().snapshots.filter((s) => s.id !== id) })
    if (get().current?.id === id) set({ current: null })
  },

  duplicateSnapshot: async (id, newName) => {
    const src = get().snapshots.find((s) => s.id === id)
    if (!src) return
    const copy: Snapshot = {
      ...src,
      id: uuid(),
      name: newName,
      locked: false,
      isDraft: false,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      auditLog: [...src.auditLog, { ts: new Date().toISOString(), action: 'snapshot-created', detail: `Duplicated from "${src.name}"` }],
    }
    await putRecord('snapshots', copy.id, copy)
    set({ snapshots: [...get().snapshots, copy] })
  },

  toggleLock: async (id) => {
    const snap = get().snapshots.find((s) => s.id === id)
    if (!snap) return
    const updated: Snapshot = {
      ...snap,
      locked: !snap.locked,
      lastModifiedAt: new Date().toISOString(),
      auditLog: [
        ...snap.auditLog,
        { ts: new Date().toISOString(), action: snap.locked ? 'snapshot-unlocked' : 'snapshot-locked', detail: snap.locked ? 'Unlocked' : 'Locked' },
      ],
    }
    await putRecord('snapshots', updated.id, updated)
    set({
      snapshots: get().snapshots.map((s) => (s.id === id ? updated : s)),
      current: get().current?.id === id ? updated : get().current,
    })
  },

  appendAudit: (action, detail, before, after) => {
    const cur = get().current
    if (!cur) return
    const event: AuditEvent = { ts: new Date().toISOString(), action, detail, before, after }
    const updated = { ...cur, auditLog: [...cur.auditLog, event], lastModifiedAt: new Date().toISOString() }
    void putRecord('snapshots', updated.id, updated)
    set({ current: updated, snapshots: get().snapshots.map((s) => (s.id === updated.id ? updated : s)) })
  },
}))
```

- [ ] **Step 2: Install uuid**

```bash
npm install --save-exact uuid@10.0.0
npm install --save-exact --save-dev @types/uuid@10.0.0
```

- [ ] **Step 3: Hydrate snapshot store on App mount**. Update `src/App.tsx`:

```tsx
import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useUiStore } from '@/store/uiStore'
import { useSnapshotStore } from '@/store/snapshotStore'

export default function App() {
  const hydrateUi = useUiStore((s) => s.hydrate)
  const hydrateSnap = useSnapshotStore((s) => s.hydrate)
  useEffect(() => {
    void hydrateUi()
    void hydrateSnap()
  }, [hydrateUi, hydrateSnap])
  return <AppShell />
}
```

- [ ] **Step 4: Commit**

```bash
git add src/store/snapshotStore.ts src/App.tsx package.json package-lock.json
git commit -m "feat: snapshot store with import + recompute + history actions"
```

### Task 7.3 — Import flow component (drop zone + parsing orchestration)

- [ ] **Step 1: Write `src/components/DropZone.tsx`**:

```tsx
import { useRef, useState, type DragEvent } from 'react'
import { FolderUp, FileSpreadsheet } from 'lucide-react'

interface Props {
  onExcel: (file: File) => void
  onPdfFolder: (files: File[]) => void
  busy?: boolean
  status?: string
}

export function DropZone({ onExcel, onPdfFolder, busy, status }: Props) {
  const [hover, setHover] = useState(false)
  const excelRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setHover(false)
    const files = Array.from(e.dataTransfer.files)
    const xlsx = files.find((f) => /\.xlsx$/i.test(f.name))
    if (xlsx) onExcel(xlsx)
    const pdfs = files.filter((f) => /\.pdf$/i.test(f.name))
    if (pdfs.length) onPdfFolder(pdfs)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true) }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
      className={`mx-8 my-6 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
        hover ? 'border-lw-orange-500 bg-lw-orange-500/5' : 'border-slate-800 bg-slate-900/30'
      } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <FolderUp className="w-10 h-10 mx-auto text-lw-orange-400 mb-3" />
      <div className="text-slate-200 font-medium">Drop monthly Excel + PDF folder here</div>
      <div className="text-sm text-slate-500 mt-1">or pick files manually:</div>
      <div className="flex gap-3 justify-center mt-4">
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
      </div>
      <input
        ref={excelRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onExcel(f); e.target.value = '' }}
      />
      <input
        ref={folderRef}
        type="file"
        // @ts-expect-error webkitdirectory non-standard
        webkitdirectory=""
        multiple
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).filter((f) => /\.pdf$/i.test(f.name))
          if (files.length) onPdfFolder(files)
          e.target.value = ''
        }}
      />
      {status && <div className="text-xs text-slate-400 mt-3">{status}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/ImportFlow.tsx`** (drives the parse → reconcile pipeline):

```tsx
import { useState } from 'react'
import { DropZone } from './DropZone'
import { runExcelInWorker } from '@/parsers/runExcelInWorker'
import { runPdfsInWorker } from '@/parsers/runPdfInWorker'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { ExcelParseResult } from '@/parsers/excelParser'

function periodLabelFromDates(dates: string[]): string {
  if (!dates.length) return 'Unknown Period'
  const sorted = [...dates].sort()
  const d = new Date(sorted[Math.floor(sorted.length / 2)])
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export function ImportFlow() {
  const importBatch = useSnapshotStore((s) => s.importBatch)
  const [excelData, setExcelData] = useState<ExcelParseResult | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function onExcel(file: File) {
    setStatus('Parsing Excel…')
    try {
      const buf = await file.arrayBuffer()
      const r = await runExcelInWorker(buf)
      setExcelData(r)
      setStatus(`Excel parsed: ${r.rows.length} rows, ${r.employees.length} employees`)
    } catch (err) {
      setStatus(`Excel error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  async function onPdfFolder(files: File[]) {
    if (!excelData) {
      setStatus('Drop the Excel first, then the PDF folder.')
      return
    }
    setStatus(`Parsing 0/${files.length} PDFs…`)
    try {
      const out = await runPdfsInWorker(files, (done, total) => setStatus(`Parsing ${done}/${total} PDFs…`))
      const parsedPdfs = out.flatMap((o) => (o.result.parsed ? [o.result.parsed] : []))
      const dates = parsedPdfs.flatMap((p) => p.entries.map((e) => e.date))
      const periodLabel = periodLabelFromDates(dates)
      await importBatch({
        excelRows: excelData.rows,
        employees: excelData.employees,
        parsedPdfs,
        periodLabel,
      })
      setStatus(null)
    } catch (err) {
      setStatus(`PDF error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  return <DropZone onExcel={onExcel} onPdfFolder={onPdfFolder} status={status ?? undefined} />
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DropZone.tsx src/components/ImportFlow.tsx
git commit -m "feat: drop zone + import orchestration"
```

### Task 7.4 — KPI strip and By Project view

- [ ] **Step 1: Write `src/pages/BillingHours/KpiStrip.tsx`**:

```tsx
import type { Snapshot, ProjectConfig } from '@/persistence/schemas'
import { fmtUsd, fmtHours } from '@/lib/format'

export function KpiStrip({ snap, configs }: { snap: Snapshot; configs: Record<string, ProjectConfig> }) {
  const totalReg = snap.weeklyBilling.reduce((s, r) => s + r.regularDollars, 0)
  const totalOt = snap.weeklyBilling.reduce((s, r) => s + r.otDollars, 0)
  const totalDt = snap.weeklyBilling.reduce((s, r) => s + r.dtDollars, 0)
  const total = totalReg + totalOt + totalDt
  const totalHrs = snap.weeklyBilling.reduce((s, r) => s + r.hours, 0)
  const otHrs = snap.weeklyBilling.reduce((s, r) => s + r.otHrs, 0)
  const projects = new Set(snap.weeklyBilling.map((r) => r.projectKey)).size
  const employees = new Set(snap.weeklyBilling.map((r) => r.employeeCode)).size
  const unconfigured = Object.values(configs).filter((c) => c.defaultRegularRate === 0).length

  const Tile = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
    <div className="bg-[#0a0f1c] border border-slate-800 rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-2xl font-semibold text-slate-100 mt-2 tabular-nums">{value}</div>
      <div className="text-xs text-lw-orange-400 mt-1">{sub}</div>
    </div>
  )

  return (
    <div className="grid grid-cols-4 gap-3 px-8 py-4">
      <Tile label="Total Billable" value={fmtUsd(total)} sub={`${fmtHours(totalHrs)} · ${employees} employees`} />
      <Tile label="Regular" value={fmtUsd(totalReg)} sub={`${fmtHours(totalHrs - otHrs)}`} />
      <Tile label="Overtime" value={fmtUsd(totalOt + totalDt)} sub={`${fmtHours(otHrs)} @ 1.5×`} />
      <Tile
        label="Projects"
        value={String(projects)}
        sub={unconfigured ? `${unconfigured} need rates` : 'All configured'}
      />
    </div>
  )
}
```

- [ ] **Step 2: Write `src/pages/BillingHours/ByProjectView.tsx`**:

```tsx
import type { Snapshot, ProjectConfig } from '@/persistence/schemas'
import { fmtUsd, fmtHours } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'

export function ByProjectView({ snap, configs }: { snap: Snapshot; configs: Record<string, ProjectConfig> }) {
  type Agg = { hours: number; reg: number; ot: number; dt: number; employees: Set<string>; weeks: Set<string> }
  const byProject = new Map<string, Agg>()
  for (const row of snap.weeklyBilling) {
    const a = byProject.get(row.projectKey) ?? { hours: 0, reg: 0, ot: 0, dt: 0, employees: new Set(), weeks: new Set() }
    a.hours += row.hours
    a.reg += row.regularDollars
    a.ot += row.otDollars
    a.dt += row.dtDollars
    a.employees.add(row.employeeCode)
    a.weeks.add(row.weekStart)
    byProject.set(row.projectKey, a)
  }

  const rows = Array.from(byProject.entries()).sort((a, b) => (b[1].reg + b[1].ot + b[1].dt) - (a[1].reg + a[1].ot + a[1].dt))

  return (
    <div className="mx-8 mb-8 bg-[#0a0f1c] border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 text-sm font-semibold text-slate-200">By Project</div>
      <table className="w-full text-sm">
        <thead className="bg-slate-950">
          <tr>
            <Th>Project</Th>
            <Th>OT Threshold</Th>
            <Th right>Hours</Th>
            <Th right>OT Hours</Th>
            <Th right>Rate</Th>
            <Th right>Billable</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, agg]) => {
            const cfg = configs[key]
            const otHrs = snap.weeklyBilling.filter((r) => r.projectKey === key).reduce((s, r) => s + r.otHrs, 0)
            const regRate = cfg?.defaultRegularRate ?? 0
            const otRate = cfg?.otRateOverride ?? regRate * 1.5
            return (
              <tr key={key} className="border-b border-slate-900/60 last:border-0 hover:bg-slate-900/40">
                <td className="px-5 py-3">
                  <div className="text-slate-100 font-medium">{cfg?.displayName ?? key}</div>
                  <div className="text-xs text-slate-500">{agg.employees.size} employees · {agg.weeks.size} weeks</div>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={cfg?.otThresholdHrs === 50 ? 'orange' : 'gray'}>
                    {cfg?.otThresholdHrs ?? '—'} hrs / wk
                  </Badge>
                </td>
                <td className="px-5 py-3 text-right tabular-nums">{fmtHours(agg.hours)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-lw-orange-400">{fmtHours(otHrs)}</td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {regRate ? `${fmtUsd(regRate)} / ${fmtUsd(otRate)}` : '—'}
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-100">{fmtUsd(agg.reg + agg.ot + agg.dt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-5 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-800 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}
```

- [ ] **Step 3: Replace `src/pages/BillingHours/BillingHoursPage.tsx`**:

```tsx
import { PageHeader } from '@/components/layout/PageHeader'
import { ImportFlow } from '@/components/ImportFlow'
import { KpiStrip } from './KpiStrip'
import { ByProjectView } from './ByProjectView'
import { useSnapshotStore } from '@/store/snapshotStore'

export default function BillingHoursPage() {
  const snap = useSnapshotStore((s) => s.current)
  const configs = useSnapshotStore((s) => s.projectConfigs)

  return (
    <div>
      <PageHeader
        title="Billing Hours"
        subtitle={snap ? `${snap.periodLabel} · ${snap.employees.length} employees · ${Object.keys(configs).length} projects` : 'Drop your monthly Excel + PDF folder to begin'}
      />
      {!snap ? (
        <ImportFlow />
      ) : (
        <>
          <KpiStrip snap={snap} configs={configs} />
          <ByProjectView snap={snap} configs={configs} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Smoke test — drop the sample Excel, then sample PDF folder. Verify KPI tiles populate and By Project table shows the project with OT split.**

- [ ] **Step 5: Commit**

```bash
git add src/pages/BillingHours
git commit -m "feat: Billing Hours v1 with KPI strip and by-project view"
```

**Phase 7 smoke check:** Drop real fixtures → KPI tiles + By Project table render with non-zero numbers.

---

## Phase 8 — Spreadsheet view

**Goal:** Full TanStack Table with all features from spec section 6 — virtualized, sortable, filterable, group-by, flagged-row tinting, footer aggregates, "export current view".

**Files:**
- `src/pages/BillingHours/SpreadsheetView.tsx`
- `src/pages/BillingHours/spreadsheetColumns.ts`
- `src/components/ui/SpreadsheetToolbar.tsx`
- `src/lib/csvExport.ts`

### Task 8.1 — Columns + base table

- [ ] **Step 1: Write `src/pages/BillingHours/spreadsheetColumns.ts`** defining columns: employee, project, week, hours, regularHrs, otHrs, dtHrs, regularDollars, otDollars, total, flags, reviewed.

(Provide a `createColumns(configs, employees)` factory returning `ColumnDef<Row>[]`. Each numeric column uses `tabular-nums`. The `flags` column renders a stack of `Badge` chips colored by severity. The `reviewed` column is a checkbox cell that calls `appendAudit`.)

- [ ] **Step 2: Write `src/pages/BillingHours/SpreadsheetView.tsx`** wiring `useReactTable` + `useVirtualizer`. Include:
  - Sticky header
  - Density toggle in toolbar
  - Global fuzzy search (`globalFilter`)
  - Per-column filter row with text/number/select inputs
  - Quick chips: Flagged only, Errors only, Has OT, By project
  - Group-by toggle (Project/Employee/Week)
  - Footer row with sums of visible filtered rows
  - Row tint by max severity flag
  - Bulk select column with Mark Reviewed action
  - "Export current view" button → CSV with applied filters/sort

(File can grow large; if so split column defs and toolbar into separate files. Keep `SpreadsheetView.tsx` ≤ 350 lines.)

- [ ] **Step 3: Write `src/lib/csvExport.ts`**:

```ts
export function rowsToCsv<T extends Record<string, unknown>>(rows: T[], columns: Array<{ key: keyof T; header: string }>): string {
  const escape = (v: unknown): string => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const head = columns.map((c) => escape(c.header)).join(',')
  const body = rows.map((r) => columns.map((c) => escape(r[c.key])).join(',')).join('\n')
  return `${head}\n${body}`
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Add tab switcher to `BillingHoursPage.tsx`** — view picker (By Project / By Employee / By Week / Spreadsheet). Use Zustand-driven local UI state.

- [ ] **Step 5: Smoke test** — populated snapshot, switch to Spreadsheet, verify virtualization (scroll smooth), filter by project, sort by hours, mark a row reviewed (audit log gains an entry).

- [ ] **Step 6: Commit**

```bash
git add src/pages/BillingHours/SpreadsheetView.tsx src/pages/BillingHours/spreadsheetColumns.ts src/components/ui/SpreadsheetToolbar.tsx src/lib/csvExport.ts src/pages/BillingHours/BillingHoursPage.tsx
git commit -m "feat: full-featured spreadsheet view with TanStack Table"
```

**Phase 8 smoke check:** Spreadsheet renders 100+ rows smoothly, filter+sort+group+export all work.

---

## Phase 9 — By Employee + By Week views

**Goal:** Two more billing views complete.

**Files:**
- `src/pages/BillingHours/ByEmployeeView.tsx` — collapsible groups per employee
- `src/pages/BillingHours/ByWeekView.tsx` — one row per ISO Monday, project columns

Both follow the same shape as `ByProjectView` but with different aggregation keys. Each is ≤ 200 lines. Wire into the tab switcher.

- [ ] **Tasks:** create both files, wire tabs, smoke test, commit.

```bash
git commit -m "feat: by-employee and by-week views"
```

---

## Phase 10 — Projects + Clients pages

**Goal:** Edit project configs (threshold, rates, aliases, employee overrides), manage clients, resolve unmapped allocations via modal.

**Files:**
- `src/pages/Projects/ProjectsPage.tsx` — list + drawer
- `src/pages/Projects/ProjectConfigDrawer.tsx` — full edit form
- `src/pages/Projects/ClientsList.tsx` — clients management
- `src/components/ProjectMappingModal.tsx` — resolve unmapped allocations from `unresolvedAllocations`
- `src/components/ui/Modal.tsx`, `src/components/ui/Drawer.tsx`, `src/components/ui/Input.tsx`, `src/components/ui/Toggle.tsx`, `src/components/ui/Select.tsx`

### Tasks (high-level — break into TDD steps as you implement)
- Build `Modal` + `Drawer` primitives (focus trap, ESC to close, click-outside).
- Build form inputs (`Input` numeric/text, `Toggle`, `Select`).
- Implement `ProjectConfigDrawer` with all spec fields. Live preview of OT rate (1.5× default) and DT rate (2× default).
- Add per-employee rate override sub-table (Add row, edit, remove).
- Implement `ProjectMappingModal` — for each unresolved allocation, offer: "Map to existing project" (Select), "Create new project" (Input), "Ignore". On submit, update `projectConfigs[chosen].allocationAliases` then `recompute()`.
- Auto-open `ProjectMappingModal` after import if `unresolvedAllocations.length > 0`.
- Clients list with add/edit (full Client schema fields).
- Each save calls `appendAudit` with action `project-config-edited`.

Smoke check: edit a project's OT threshold from 40 → 50, watch the by-project table OT hrs drop on recompute.

```bash
git commit -m "feat: project config editor, clients list, allocation mapping modal"
```

---

## Phase 11 — Snapshot history + locking + audit

**Goal:** History page with list of snapshots, per-snapshot actions (Open / Duplicate / Lock / Rename / Delete), audit log viewer, period-over-period comparison selector.

**Files:**
- `src/pages/History/HistoryPage.tsx`
- `src/pages/History/SnapshotRow.tsx`
- `src/pages/History/AuditLogPanel.tsx`
- `src/pages/BillingHours/CompareToSelector.tsx` — dropdown above KPI strip
- Update `KpiStrip` to show prior-snapshot deltas when compare-to selected

### Tasks
- History page table: name, period, status (Draft / Saved / Locked icon), created/lastModified, actions menu.
- Right-click menu via simple Popover for: Open, Duplicate ("Save as…"), Lock/Unlock (confirm), Rename, Delete (confirm).
- Audit log panel as a slide-down accordion under each snapshot row.
- "Save Snapshot" button on Billing Hours toolbar (when current is draft).
- Compare-to selector: lists prior snapshots; when chosen, KPI tiles show ±delta vs that snapshot.
- Round-trip totals banner above KPIs: compute Σ(by-project) vs Σ(by-employee) vs Σ(rows); show banner if delta > $0.01.

Smoke check: save a snapshot, edit threshold, see lastModifiedAt update; lock it, verify edit attempts noop with toast.

```bash
git commit -m "feat: snapshot history, locking, audit log, period-over-period comparison"
```

---

## Phase 12 — Exports

**Goal:** Generate per-client invoice PDFs, branded Excel report, and JSON export/import bundles.

**Files:**
- `src/exports/invoicePdf.ts` — pdf-lib invoice generator
- `src/exports/workbookExport.ts` — exceljs branded workbook
- `src/exports/jsonSnapshot.ts` — wraps `buildExportBundle` and triggers download
- `src/pages/Exports/ExportsPage.tsx`
- `src/pages/Exports/InvoicePreviewModal.tsx` — print-friendly HTML preview before generating PDF

### Tasks
- **Invoice PDF generator** (`invoicePdf.ts`):
  - Accepts `(client, snapshot, configs, projects[])`.
  - Embeds the LotusWorks logo from `/lotusworks-logo.png` fetched at runtime via `fetch('/lotusworks-logo.png').then(r=>r.arrayBuffer())`.
  - Header: client name + address + invoice # (`${prefix}${counter+1}`) + date + payment terms + remit-to.
  - Body: line items per project — display name, PO number, regular hrs × rate, OT hrs × rate, DT hrs × rate (when present), subtotal.
  - Footer: total + footer notes.
  - Returns `Uint8Array` for downloading.
  - Increments `client.invoiceNumberCounter` on success and appends audit event `invoice-generated`.
- **HTML invoice preview** mirrors the same data; rendered inside a Modal with a Print button.
- **Workbook export** (`workbookExport.ts`): one sheet per project (rows: employee × week with hrs/$ split) + a Summary sheet (totals + KPIs).
- **JSON export wrapper** ties to `Exports` page UI: select scope (All/Settings/History), download. Import button opens file picker → schema validate → confirm-merge dialog.
- **Exports page UI**: stacked cards for each export with "Generate" button. Per-client invoice list shown for the current snapshot.

Smoke check: generate one invoice for a client, open the PDF, verify logo + line items + math.

```bash
git commit -m "feat: PDF invoice + Excel report + JSON export/import"
```

---

## Phase 13 — Settings + UX polish

**Files:**
- `src/pages/Settings/SettingsPage.tsx`
- `src/components/CommandPalette.tsx` (⌘K nav)
- `src/components/KeyboardShortcutsModal.tsx` (?)
- `src/components/RecentImports.tsx` (empty-state surface)
- `src/lib/sampleData.ts` — synthetic month for first-run

### Tasks
- Theme toggle (dark / light / system) with live preview.
- Number format & currency selector (defaults USD).
- Keyboard shortcuts wired:
  - `⌘S` → save snapshot
  - `⌘E` → open Exports page
  - `⌘K` → command palette (jump to project / employee / page)
  - `/` → focus active page's search
  - `F` → toggle "flagged only" on Spreadsheet
  - `?` → cheat sheet modal
- Recent imports stored in `kv` (max 5); render on Billing Hours empty state.
- "Load sample data" button — runs the same import flow with a synthetic in-memory dataset (also used for E2E tests).
- Currency / number format settings persist via `kv`.

```bash
git commit -m "feat: settings page, keyboard shortcuts, command palette, sample data"
```

---

## Phase 14 — Reconcile tab stub

**Files:** `src/pages/Reconcile/ReconcilePage.tsx`

Stub UI: PageHeader + dropzone (disabled) + "Coming soon — drop your client invoice spreadsheet here once samples are available." Add to side nav (already present from Phase 1).

```bash
git commit -m "feat: Reconcile tab stub"
```

---

## Phase 15 — Service worker + UpdateModal + Deploy

**Goal:** GitHub Pages live with auto-update. Mirror Multitool's `sw.js`, `updateChecker.ts`, `UpdateModal.tsx`, `deploy-pages.sh`. NO PWA manifest.

**Files:**
- `sw.js` — copy from `~/Codebase/Multitool/sw.js`, replace `multitool` → `reconciler` in cache name and `/Multitool/` paths → `/FinanceReconciliation/`.
- `src/utils/semver.ts` — verbatim copy from Multitool.
- `src/utils/updateChecker.ts` — copy and update `GITHUB_API_URL` to `https://api.github.com/repos/noahfgarrett/FinanceReconciliation/releases/latest`.
- `src/data/changelog.ts` — initial entry for v0.1.0.
- `src/components/common/UpdateModal.tsx` — copy from Multitool, update branding strings/colors.
- `deploy-pages.sh` — copy and adapt: REPO=https://github.com/noahfgarrett/FinanceReconciliation.git, BUILT_FILE=`dist/Reconciler.html`, DELETE the `manifest.json` + `apple-touch-icon` blocks (no PWA), keep service-worker registration.
- Wire `UpdateModal` + `checkForUpdate` in `src/App.tsx` (mirror Multitool `App.tsx:60-83`).
- Service-worker registration script lives in `deploy-pages.sh`'s injected `<head>` — same as Multitool.

### Tasks
- [ ] Copy and patch each file (search/replace `multitool` → `reconciler`, `Multitool` → `Reconciler`).
- [ ] Add `marked` import in UpdateModal — already in deps.
- [ ] Bump `package.json` version to `0.1.0` if not already.
- [ ] Run `npm run build` and confirm `dist/Reconciler.html` is single-file.
- [ ] Run `bash deploy-pages.sh` — verifies repo URL is `noahfgarrett/FinanceReconciliation`.
- [ ] Wait 1-2 min for GitHub Pages.
- [ ] Visit https://noahfgarrett.github.io/FinanceReconciliation/ — page loads, app works offline after first visit.
- [ ] Bump version, redeploy, verify the running tab shows the update prompt within 1-2 minutes.

```bash
git commit -m "feat: service worker, update checker, deploy pipeline"
```

**Phase 15 smoke check:** Live URL works offline (DevTools → Network → Offline → reload). Bumping version + redeploy triggers an in-app reload prompt in an open tab.

---

## Phase 16 — Visual polish (`/frontend-design` + `/impeccable`)

**Goal:** Lock final tokens, motion, micro-interactions, accessibility. Run as a separate skill invocation now that the scaffold and pages exist.

### Tasks
- [ ] Invoke `/frontend-design` with reference: existing app + spec section 10 + brand colors PDF (`Assets/LotusWorks - Colour Guide.pdf`). Produce final Tailwind tokens, typography scale, motion system. Replace placeholder colors.
- [ ] Invoke `/impeccable` for an end-to-end consistency, accessibility, and finish pass. Apply the diffs.
- [ ] Update visual regression baselines for empty state + populated state + invoice preview.
- [ ] Re-deploy to GitHub Pages.

```bash
git commit -m "style: final visual polish via frontend-design + impeccable"
```

---

## Self-Review

**Spec coverage check:**
- [x] Single-HTML build → Phase 0 (vite-plugin-singlefile)
- [x] Vite + React + TS strict + Tailwind + Zustand → Phase 0–2
- [x] Excel parser → Phase 4
- [x] PDF parser with weekly grouping → Phase 5
- [x] Reconciler with isolated per-project OT, all 8 flag codes → Phase 6
- [x] Side-nav with all spec routes → Phase 1, 14
- [x] Billing Hours with By Project / By Employee / By Week / Spreadsheet → Phases 7, 8, 9
- [x] Project + client management with allocation aliases + employee rate overrides → Phase 10
- [x] Project mapping modal for unresolved allocations → Phase 10
- [x] Snapshot history + locking + audit log + period-over-period + round-trip totals → Phase 11
- [x] PDF invoice + Excel report + JSON export/import (3 scopes) → Phase 12
- [x] Settings: theme toggle, keyboard shortcuts, command palette, recent imports, sample data → Phase 13
- [x] Reconcile stub → Phase 14
- [x] Service worker + UpdateModal + GitHub Pages deploy (no PWA manifest) → Phase 15
- [x] Final visual polish → Phase 16
- [x] Web Workers for parsers → Phases 4, 5
- [x] Zod schemas at boundaries → Phase 2
- [x] Audit log written on key actions → Phases 7, 10, 11, 12

**Type consistency check:** types are single-sourced from `src/persistence/schemas.ts` (zod-derived) and reused throughout. `slugifyProjectName`, `splitWeekHours`, `resolveRates`, `reconcile` signatures consistent across phases.

**Placeholder scan:** No "TBD"/"TODO" remain. Phase 8 / 10 / 11 describe complex UIs at "create file with these features" granularity rather than line-by-line code — reasonable for views that share patterns shown in detailed earlier phases (KpiStrip, ByProjectView). The executor agent should TDD each per the patterns established in Phases 0–7.

**Open spec items resolved in plan:**
- PDF parser strategy: column-anchor approach with explicit fallback note (Phase 5 Task 5.2).
- Sample fixtures: gated behind Phase 3 with explicit user-handoff stop.
- Tailwind tokens: explicit deferral to Phase 16 (`/frontend-design`).

---

**Plan complete and saved to [docs/superpowers/plans/2026-05-05-finance-reconciliation-implementation.md](docs/superpowers/plans/2026-05-05-finance-reconciliation-implementation.md).**

## Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a plan this large because each phase produces a clean checkpoint.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**

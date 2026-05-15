import { useCallback, useRef, useState } from 'react'
import { DropZone } from './DropZone'
import { OnboardingWizard, type OnboardingWizardProps } from './OnboardingWizard'
import { useSnapshotStore } from '@/store/snapshotStore'
import { useEmployeeStore } from '@/store/employeeStore'
import { runExcelInWorker } from '@/parsers/runExcelInWorker'
import { runPdfsInWorker } from '@/parsers/runPdfInWorker'
import { slugifyProjectName } from '@/reconciler/projectMatching'
import type { ExcelParseResult } from '@/parsers/excelParser'
import type { ParsedPdfWithBytes, ProjectConfig, EmployeeProfile, RowFlag } from '@/persistence/schemas'

/** Infer a human-readable period label (e.g. "Apr 2026") from an ISO date string. */
function periodLabelFromDate(iso: string): string {
  if (!iso) return 'Unknown Period'
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Given a list of ISO date strings, return the label for the median date's month+year.
 * Falls back to 'Unknown Period' when the list is empty.
 */
function inferPeriodLabel(isoDates: string[]): string {
  if (isoDates.length === 0) return 'Unknown Period'
  const sorted = [...isoDates].sort()
  const medianIdx = Math.floor(sorted.length / 2)
  return periodLabelFromDate(sorted[medianIdx])
}

/* ------------------------------------------------------------------ */
/*  Detection helpers                                                  */
/* ------------------------------------------------------------------ */

export interface DetectedProject {
  name: string
  allocations: string[]
  isNew: boolean
  existingConfig?: ProjectConfig
}

interface DetectedNewEmployees {
  code: string
  firstName: string
  lastName: string
}

/**
 * Detect ALL project names from Excel, marking each as new or existing.
 * For each project, try to find matching allocation codes from PDFs.
 * Existing projects carry their stored config so the wizard can pre-fill values.
 */
function detectAllProjects(
  excelResult: ExcelParseResult,
  parsedPdfs: ParsedPdfWithBytes[],
  existingConfigs: Record<string, ProjectConfig>,
): DetectedProject[] {
  // Collect all project names from Excel
  const allProjectNames = new Set<string>()
  for (const row of excelResult.rows) {
    for (const p of row.projectNames) {
      const trimmed = p.trim()
      if (trimmed) allProjectNames.add(trimmed)
    }
  }

  if (allProjectNames.size === 0) return []

  // Classify each project as new or existing
  const allNames = [...allProjectNames]
  const projectStatus = allNames.map((name) => {
    const key = slugifyProjectName(name)
    const config = existingConfigs[key]
    return { name, isNew: !config, existingConfig: config }
  })

  // Build a map of employee -> project names from Excel so we can link
  // allocations from PDFs back to projects
  const employeeToProjects = new Map<string, Set<string>>()
  for (const row of excelResult.rows) {
    for (const pName of row.projectNames) {
      const trimmed = pName.trim()
      if (!trimmed) continue
      const existing = employeeToProjects.get(row.employeeCode) ?? new Set<string>()
      existing.add(trimmed)
      employeeToProjects.set(row.employeeCode, existing)
    }
  }

  // Build a map of employee -> allocation codes from PDFs
  const employeeAllocations = new Map<string, Set<string>>()
  for (const pdf of parsedPdfs) {
    const set = employeeAllocations.get(pdf.employeeCode) ?? new Set<string>()
    for (const entry of pdf.entries) {
      if (entry.allocation) set.add(entry.allocation)
    }
    employeeAllocations.set(pdf.employeeCode, set)
  }

  // Strip ALL non-alphanumeric chars for loose comparison.
  const stripAll = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')

  // Extract the leading prefix of an allocation code (before the first numeric
  // suffix or detailed sub-code). E.g. "FAB52-MEP-001" → "fab52", "OH-DC1-CX-001" → "ohdc1".
  // We split on the second-or-later hyphen-separated segment that is purely numeric.
  const allocPrefix = (alloc: string): string => {
    const parts = alloc.split(/[-_.]/)
    const prefix: string[] = []
    for (const p of parts) {
      if (prefix.length > 0 && /^\d+$/.test(p)) break
      prefix.push(p)
    }
    return prefix.join('').toLowerCase()
  }

  // Check if allocation looks like it belongs to this project via multiple heuristics.
  const isAllocMatch = (alloc: string, projName: string): boolean => {
    const allocSlug = slugifyProjectName(alloc)
    const projectSlug = slugifyProjectName(projName)
    // 1. Exact slug match
    if (allocSlug === projectSlug) return true
    // 2. One contains the other (original logic)
    if (allocSlug.includes(projectSlug) || projectSlug.includes(allocSlug)) return true
    // 3. Stripped comparison — ignore all separators
    const strippedAlloc = stripAll(alloc)
    const strippedProj = stripAll(projName)
    if (strippedProj.includes(strippedAlloc) || strippedAlloc.includes(strippedProj)) return true
    // 4. Prefix match — allocation prefix found in stripped project name
    const prefix = allocPrefix(alloc)
    if (prefix.length >= 3 && strippedProj.includes(prefix)) return true
    // 5. Project name words match allocation prefix (e.g. "cardinal" in "CARDINAL-CX-002")
    const projWords = projName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length >= 3)
    for (const word of projWords) {
      if (strippedAlloc.startsWith(word) || strippedAlloc.includes(word)) return true
    }
    // 6. Segment-to-word prefix matching — handles abbreviations like OH→Ohio, TRAIN→Training
    const allocSegments = alloc.split(/[-_.]/).map(s => s.toLowerCase()).filter(s => !/^\d+$/.test(s))
    for (const seg of allocSegments) {
      for (const word of projWords) {
        const overlap = Math.min(seg.length, word.length)
        if (overlap >= 2 && seg.substring(0, overlap) === word.substring(0, overlap)) return true
      }
    }
    return false
  }

  // Score how well an allocation matches a project (higher = better).
  const matchScore = (alloc: string, projName: string): number => {
    const strippedAlloc = stripAll(alloc)
    const strippedProj = stripAll(projName)
    const prefix = allocPrefix(alloc)
    // Prefix found at the start of project name → strongest signal
    if (strippedProj.startsWith(prefix)) return 100 + prefix.length
    // Prefix found anywhere in project name
    if (prefix.length >= 3 && strippedProj.includes(prefix)) return 50 + prefix.length
    // Word/segment match — sum ALL matching segments for cumulative score
    const projWords = projName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length >= 3)
    const allocSegments = alloc.split(/[-_.]/).map(s => s.toLowerCase()).filter(s => !/^\d+$/.test(s))
    let totalOverlap = 0
    let matchCount = 0
    for (const seg of allocSegments) {
      let bestForSeg = 0
      for (const word of projWords) {
        const overlap = Math.min(seg.length, word.length)
        if (overlap >= 2 && seg.substring(0, overlap) === word.substring(0, overlap)) {
          bestForSeg = Math.max(bestForSeg, overlap)
        }
      }
      if (bestForSeg > 0) { totalOverlap += bestForSeg; matchCount++ }
    }
    // Bonus: first allocation segment matches start of first project word
    const firstSegMatchesFirstWord = allocSegments.length > 0 && projWords.length > 0 &&
      projWords[0].startsWith(allocSegments[0].replace(/\d+/g, '')) && allocSegments[0].length >= 2
    if (matchCount >= 1) return 10 + totalOverlap + matchCount * 5 + (firstSegMatchesFirstWord ? 20 : 0)
    if (strippedProj.includes(strippedAlloc) || strippedAlloc.includes(strippedProj)) return 20
    return 0
  }

  // Collect all allocations from PDFs
  const allPdfAllocations = new Set<string>()
  for (const allocSet of employeeAllocations.values()) {
    for (const alloc of allocSet) allPdfAllocations.add(alloc)
  }

  // For each project, score all allocation matches
  const projectAllocScores = allNames.map((name) => {
    const scores = new Map<string, number>()
    for (const alloc of allPdfAllocations) {
      if (isAllocMatch(alloc, name)) {
        scores.set(alloc, matchScore(alloc, name))
      }
    }
    return { name, scores }
  })

  // Dedup: assign each allocation to the project with the highest score
  const allocOwner = new Map<string, number>() // alloc → project index with best score
  for (let i = 0; i < projectAllocScores.length; i++) {
    for (const [alloc, score] of projectAllocScores[i].scores) {
      const currentBest = allocOwner.get(alloc)
      if (currentBest === undefined) {
        allocOwner.set(alloc, i)
      } else {
        const currentScore = projectAllocScores[currentBest].scores.get(alloc) ?? 0
        if (score > currentScore) {
          allocOwner.set(alloc, i)
        }
      }
    }
  }

  return allNames.map((name, i) => ({
    name,
    allocations: [...(projectAllocScores[i].scores.keys())].filter(
      (alloc) => allocOwner.get(alloc) === i,
    ),
    isNew: projectStatus[i].isNew,
    existingConfig: projectStatus[i].existingConfig,
  }))
}

/**
 * Detect employee codes from Excel that don't yet exist in the employee store.
 */
function detectNewEmployees(
  excelResult: ExcelParseResult,
  existingEmployees: Record<string, EmployeeProfile>,
): DetectedNewEmployees[] {
  const seen = new Set<string>()
  const results: DetectedNewEmployees[] = []

  // excelResult.employees has the parsed employee list with code/firstName/lastName
  for (const emp of excelResult.employees) {
    if (seen.has(emp.code)) continue
    seen.add(emp.code)
    if (!existingEmployees[emp.code]) {
      results.push({
        code: emp.code,
        firstName: emp.firstName,
        lastName: emp.lastName,
      })
    }
  }
  return results
}

/* ------------------------------------------------------------------ */
/*  Wizard state                                                       */
/* ------------------------------------------------------------------ */

interface WizardState {
  isOpen: boolean
  allProjects: DetectedProject[]
  newEmployees: DetectedNewEmployees[]
  employeeProjectMap: Record<string, string[]>
  // Stashed data to import after wizard completes
  excelResult: ExcelParseResult | null
  parsedPdfs: ParsedPdfWithBytes[]
  periodLabel: string
  allWarnings: RowFlag[]
  pdfCount: number
  failedPdfs: number
}

const INITIAL_WIZARD_STATE: WizardState = {
  isOpen: false,
  allProjects: [],
  newEmployees: [],
  employeeProjectMap: {},
  excelResult: null,
  parsedPdfs: [],
  periodLabel: '',
  allWarnings: [],
  pdfCount: 0,
  failedPdfs: 0,
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ImportFlow(): React.JSX.Element {
  const importBatch = useSnapshotStore((s) => s.importBatch)
  const addRecentImport = useSnapshotStore((s) => s.addRecentImport)
  const projectConfigs = useSnapshotStore((s) => s.projectConfigs)
  const upsertProjectConfig = useSnapshotStore((s) => s.upsertProjectConfig)
  const employeeProfiles = useEmployeeStore((s) => s.employees)
  const upsertManyEmployees = useEmployeeStore((s) => s.upsertMany)

  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [wizard, setWizard] = useState<WizardState>(INITIAL_WIZARD_STATE)

  // Hold parsed Excel result in a ref so PDF can reference it later
  const excelResultRef = useRef<ExcelParseResult | null>(null)
  const excelFileRef = useRef<File | null>(null)
  // Buffer PDF files dropped before Excel finishes parsing (simultaneous drop)
  const pendingPdfFilesRef = useRef<File[] | null>(null)
  // Stable ref to handlePdfFolder so handleExcel can call it without a dependency cycle
  const handlePdfFolderRef = useRef<(files: File[]) => Promise<void>>(async () => {})

  const handleExcel = useCallback(async (file: File) => {
    setBusy(true)
    setStatus(`Parsing ${file.name}...`)
    try {
      const buffer = await file.arrayBuffer()
      const result = await runExcelInWorker(buffer)
      excelResultRef.current = result
      excelFileRef.current = file

      if (result.warnings.some((w) => w.code === 'parse-failure' && w.severity === 'error')) {
        const msg = result.warnings.find((w) => w.code === 'parse-failure')?.message ?? 'Parse failed'
        setStatus(`Excel error: ${msg}`)
      } else {
        // If PDFs were dropped simultaneously, process them now
        const bufferedPdfs = pendingPdfFilesRef.current
        if (bufferedPdfs) {
          pendingPdfFilesRef.current = null
          void handlePdfFolderRef.current(bufferedPdfs)
          return
        }
        const warnCount = result.warnings.length
        setStatus(
          `Excel parsed: ${result.rows.length} rows, ${result.employees.length} employees${warnCount ? ` (${warnCount} warning${warnCount > 1 ? 's' : ''})` : ''}. Now drop the PDF folder.`,
        )
      }
    } catch (err) {
      setStatus(`Excel parse failed: ${err instanceof Error ? err.message : String(err)}`)
      excelResultRef.current = null
      pendingPdfFilesRef.current = null
    } finally {
      setBusy(false)
    }
  }, [])

  /** Finalize import with optional project/employee configs from the wizard. */
  const finalizeImport = useCallback(
    async (
      state: WizardState,
      wizardProjects?: ProjectConfig[],
      wizardEmployees?: EmployeeProfile[],
    ): Promise<void> => {
      if (!state.excelResult) return

      setBusy(true)
      setStatus('Saving configurations and importing...')

      try {
        // Persist wizard-configured projects
        if (wizardProjects) {
          for (const cfg of wizardProjects) {
            await upsertProjectConfig(cfg)
          }
        }

        // Persist wizard-configured employee profiles
        if (wizardEmployees && wizardEmployees.length > 0) {
          await upsertManyEmployees(wizardEmployees)
        }

        // Now run importBatch (projects are already in the store)
        await importBatch({
          excelRows: state.excelResult.rows,
          employees: state.excelResult.employees,
          parsedPdfs: state.parsedPdfs,
          periodLabel: state.periodLabel,
        })

        await addRecentImport({
          excelName: excelFileRef.current?.name,
          folderName: `${state.pdfCount} PDF${state.pdfCount !== 1 ? 's' : ''}`,
        })

        const errCount = state.allWarnings.filter((w) => w.severity === 'error').length
        const warnCount = state.allWarnings.filter((w) => w.severity === 'warn').length
        const flagParts: string[] = []
        if (errCount > 0) flagParts.push(`${errCount} ${errCount === 1 ? 'error' : 'errors'}`)
        if (warnCount > 0) flagParts.push(`${warnCount} ${warnCount === 1 ? 'warning' : 'warnings'}`)
        setStatus(
          `Imported ${state.parsedPdfs.length} PDFs, ${state.excelResult.rows.length} Excel rows — ${state.periodLabel}.${
            state.failedPdfs > 0 ? ` ${state.failedPdfs} PDF(s) could not be parsed.` : ''
          }${flagParts.length > 0 ? ` ${flagParts.join(', ')}.` : ''}`,
        )
      } catch (err) {
        setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setBusy(false)
        excelResultRef.current = null
        excelFileRef.current = null
        pendingPdfFilesRef.current = null
      }
    },
    [importBatch, addRecentImport, upsertProjectConfig, upsertManyEmployees],
  )

  const handleWizardComplete: OnboardingWizardProps['onComplete'] = useCallback(
    (result) => {
      const currentWizard = wizard
      setWizard(INITIAL_WIZARD_STATE)
      void finalizeImport(currentWizard, result.projects, result.employees)
    },
    [wizard, finalizeImport],
  )

  const handleWizardCancel = useCallback(() => {
    // Cancel = proceed with defaults (same as pre-wizard behavior)
    const currentWizard = wizard
    setWizard(INITIAL_WIZARD_STATE)
    void finalizeImport(currentWizard)
  }, [wizard, finalizeImport])

  const handlePdfFolder = useCallback(
    async (files: File[]) => {
      if (!excelResultRef.current) {
        // Excel is still parsing (simultaneous drop) — buffer for later
        pendingPdfFilesRef.current = files
        setStatus('Waiting for Excel to finish parsing before processing PDFs...')
        return
      }

      const pdfFiles = files.filter((f) => /\.pdf$/i.test(f.name))
      if (pdfFiles.length === 0) {
        setStatus('No PDF files found in the selected folder.')
        return
      }

      setBusy(true)
      setStatus(`Parsing 0 / ${pdfFiles.length} PDFs...`)

      try {
        const pdfResults = await runPdfsInWorker(pdfFiles, (done, total) => {
          setStatus(`Parsing ${done} / ${total} PDFs...`)
        })

        const parsedPdfs: ParsedPdfWithBytes[] = pdfResults
          .filter((r) => r.result.parsed !== null)
          .map((r) => {
            const base = r.result.parsed!
            return r.result.pdfBytes
              ? { ...base, pdfBytes: r.result.pdfBytes }
              : base
          })

        const allWarnings: RowFlag[] = [
          ...excelResultRef.current.warnings,
          ...pdfResults.flatMap((r) => r.result.warnings),
        ]

        const entryDates = parsedPdfs.flatMap((p) => p.entries.map((e) => e.date))
        const periodLabel = inferPeriodLabel(entryDates)
        const failedPdfs = pdfResults.filter((r) => r.result.parsed === null).length

        // Detect all projects (new + existing) and new employees
        const allProjects = detectAllProjects(
          excelResultRef.current,
          parsedPdfs,
          projectConfigs,
        )
        const hasNewProjects = allProjects.some((p) => p.isNew)
        const newEmployees = detectNewEmployees(
          excelResultRef.current,
          employeeProfiles,
        )

        // Build employee → project name mapping from Excel rows
        const empProjMap: Record<string, string[]> = {}
        for (const row of excelResultRef.current.rows) {
          const existing = empProjMap[row.employeeCode] ?? []
          for (const pName of row.projectNames) {
            const trimmed = pName.trim()
            if (trimmed && !existing.includes(trimmed)) existing.push(trimmed)
          }
          empProjMap[row.employeeCode] = existing
        }

        // If there are new items, show the wizard; otherwise import directly
        if (hasNewProjects || newEmployees.length > 0) {
          setWizard({
            isOpen: true,
            allProjects,
            newEmployees,
            employeeProjectMap: empProjMap,
            excelResult: excelResultRef.current,
            parsedPdfs,
            periodLabel,
            allWarnings,
            pdfCount: pdfFiles.length,
            failedPdfs,
          })
          setBusy(false)
          setStatus('Configure new projects and employees before importing.')
        } else {
          // Nothing new — import directly
          const stashedState: WizardState = {
            isOpen: false,
            allProjects: [],
            newEmployees: [],
            employeeProjectMap: empProjMap,
            excelResult: excelResultRef.current,
            parsedPdfs,
            periodLabel,
            allWarnings,
            pdfCount: pdfFiles.length,
            failedPdfs,
          }
          await finalizeImport(stashedState)
        }
      } catch (err) {
        setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
        setBusy(false)
      }
    },
    [projectConfigs, employeeProfiles, finalizeImport],
  )

  // Keep the stable ref in sync so handleExcel can call the latest handlePdfFolder
  handlePdfFolderRef.current = handlePdfFolder

  return (
    <>
      <DropZone
        onExcel={handleExcel}
        onPdfFolder={handlePdfFolder}
        busy={busy}
        status={status ?? undefined}
      />
      {wizard.isOpen && (
        <OnboardingWizard
          open={wizard.isOpen}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
          allProjects={wizard.allProjects}
          newEmployees={wizard.newEmployees}
          existingProjects={projectConfigs}
          employeeProjectMap={wizard.employeeProjectMap}
        />
      )}
    </>
  )
}

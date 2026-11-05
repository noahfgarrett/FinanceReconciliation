import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { SAMPLE_XLSX } from './helpers'

/** Generate the fictional sample data (test-data/output/) if it isn't there yet. */
export default function globalSetup(): void {
  if (existsSync(SAMPLE_XLSX)) return
  execFileSync(process.execPath, ['--experimental-strip-types', 'test-data/generate.ts'], {
    stdio: 'inherit',
  })
}

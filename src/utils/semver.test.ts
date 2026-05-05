import { describe, it, expect } from 'vitest'
import { isNewer } from './semver'

describe('isNewer', () => {
  it('detects newer patch', () => expect(isNewer('1.0.1', '1.0.0')).toBe(true))
  it('detects newer minor', () => expect(isNewer('1.1.0', '1.0.9')).toBe(true))
  it('detects newer major', () => expect(isNewer('2.0.0', '1.99.99')).toBe(true))
  it('returns false for equal', () => expect(isNewer('1.0.0', '1.0.0')).toBe(false))
  it('returns false for older', () => expect(isNewer('1.0.0', '1.0.1')).toBe(false))
  it('strips leading v', () => expect(isNewer('v1.0.1', '1.0.0')).toBe(true))
})

export function runMigrations(currentVersion: number): number {
  // Bump and add a case here when introducing a new schema version.
  // No migrations needed at v1.
  return currentVersion
}

export function releaseDateForVersion(changelog: string, version: string): string | null {
  const prefix = `## [${version}] - `
  const line = changelog.split(/\r?\n/).find((entry) => entry.startsWith(prefix))
  const date = line?.slice(prefix.length)
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date
}

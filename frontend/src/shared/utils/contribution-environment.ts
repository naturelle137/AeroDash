// @IMP-UI-SHARED-009@ (FROM: @REQ-SYS-017@, @DES-UX-015@)
//
// Builds the auto-detected "Environment" string prefilled in the in-app
// defect form before handoff to the GitHub bug_report template. The user
// can edit the field before submitting on GitHub, so any detail that may
// be wrong is corrigible — this helper exists only to save typing.

export interface ContributionEnvironmentSources {
  userAgent: string
  viewportWidth: number | null
  viewportHeight: number | null
  theme: 'light' | 'dark' | null
  appVersion: string | null
}

export function buildContributionEnvironment(src: ContributionEnvironmentSources): string {
  const lines: string[] = []
  if (src.userAgent.trim() !== '') {
    lines.push(`User-Agent: ${src.userAgent.trim()}`)
  }
  if (src.viewportWidth !== null && src.viewportHeight !== null) {
    lines.push(`Viewport: ${src.viewportWidth} × ${src.viewportHeight}`)
  }
  if (src.theme !== null) {
    lines.push(`Theme: ${src.theme}`)
  }
  if (src.appVersion !== null && src.appVersion.trim() !== '') {
    lines.push(`AeroDash version: ${src.appVersion.trim()}`)
  }
  return lines.join('\n')
}

export function detectEnvironmentSources(): ContributionEnvironmentSources {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const vw = typeof window !== 'undefined' ? window.innerWidth : null
  const vh = typeof window !== 'undefined' ? window.innerHeight : null
  const themeAttr =
    typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null
  const theme: ContributionEnvironmentSources['theme'] =
    themeAttr === 'dark' ? 'dark' : themeAttr === 'light' ? 'light' : null
  const version =
    typeof import.meta !== 'undefined' &&
    typeof (import.meta as { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION ===
      'string'
      ? ((import.meta as { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION ?? null)
      : null
  return {
    userAgent: ua,
    viewportWidth: vw,
    viewportHeight: vh,
    theme,
    appVersion: version,
  }
}

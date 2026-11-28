import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import { evaluateVerificationFreshness } from '@/core/logic/profile-verification'
import type { Notification } from '@/modules/mass-balance/stores/mass-balance.types'

/** Parameters carried by a saved or exported preparation file. */
const savedParameters = ['aircraft.profile.status', 'massBalance.loading', 'fuel.entries', 'performance.entries']

/** CRIT-UI-001 for Save and non-Briefing-Pack Export; null when the profile verification is fresh. */
export function exportUnverifiedGate(profile: AircraftProfile | null, now: Date) {
  const freshness = profile ? evaluateVerificationFreshness(profile, now) : null
  if (profile && freshness?.state === 'fresh') return null
  const status = profile ? `${profile.status}; ${freshness?.state}` : 'no aircraft profile'
  const notification: Notification = { id: 'CRIT-UI-001', severity: 'CRITICAL', message: 'Unverified Data Present',
    context: 'UI.Validation', persistent: true, dismissible: false,
    action: { label: 'Review', event: 'ui.review_unverified', payload: { parameters: savedParameters, canForceSave: true } } }
  return { notification, parameters: savedParameters, status }
}

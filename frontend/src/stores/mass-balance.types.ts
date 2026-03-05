/**
 * Canonical state machine type for the Mass & Balance module.
 *
 * One single pointer — no `isError`, no `hasWarning`, no duplicate states.
 * Governed by {@link file://../../../docs/architecture/frontend_state_machine.md}.
 */
export type MassBalanceState =
  | 'INITIAL'
  | 'LOADING'
  | 'UNCONFIGURED'
  | 'UNVERIFIED'
  | 'VERIFIED_SAFE'
  | 'WARNING'
  | 'ERROR_CRITICAL'

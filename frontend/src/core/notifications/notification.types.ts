/**
 * Global Notification System Types.
 * P1 Safety Core - Agnostic of feature modules.
 *
 * @see docs/architecture/notification_schema.md
 */

// @IMP-NOTIF-001@ (FROM: @DES-ARCH-001@)
export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface NotificationAction {
  label: string
  event: string
  payload?: Record<string, unknown>
}

export interface Notification {
  id: string
  severity: NotificationSeverity
  message: string
  context?: string
  persistent?: boolean
  dismissible?: boolean
  action?: NotificationAction
}

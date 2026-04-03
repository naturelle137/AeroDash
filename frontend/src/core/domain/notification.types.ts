/**
 * Global Notification System Types.
 * P1 Safety Core - Agnostic of feature modules.
 *
 * @see docs/architecture/notification_schema.md
 */

// @IMP-SYS-CORE-001@ (FROM: @REQ-SYS-011@, @REQ-SYS-012@, @DES-ARCH-001@)
export type {
  Notification,
  NotificationAction,
  NotificationSeverity,
} from './notification.schema'

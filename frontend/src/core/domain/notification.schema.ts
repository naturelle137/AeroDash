import { z } from 'zod'

/**
 * Zod schemas for the Generic Notification System.
 * P1 Safety Core — pure TypeScript, no framework dependencies.
 *
 * @see docs/architecture/notification_schema.md
 */

// @IMP-SYS-CORE-004@ (FROM: @REQ-SYS-007@, @REQ-SYS-008@, @DES-ARCH-001@)
export const NotificationSeveritySchema = z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL'])

export const NotificationActionSchema = z.object({
  label: z.string(),
  event: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const NotificationSchema = z.object({
  id: z.string(),
  severity: NotificationSeveritySchema,
  message: z.string(),
  context: z.string().optional(),
  persistent: z.boolean().default(false),
  dismissible: z.boolean().default(true),
  action: NotificationActionSchema.optional(),
})

export type NotificationSeverity = z.infer<typeof NotificationSeveritySchema>
export type NotificationAction = z.infer<typeof NotificationActionSchema>
export type Notification = z.infer<typeof NotificationSchema>

import { describe, expect, it } from 'vitest'
import { NotificationActionSchema, NotificationSchema } from './notification.schema'

describe('NotificationActionSchema', () => {
  // @UT-SYS-CORE-021@ (FROM: @IMP-SYS-CORE-004@)
  it('accepts a valid action with all fields', () => {
    const result = NotificationActionSchema.safeParse({
      label: 'Reload',
      event: 'sys.reload',
      payload: { targetVersion: '1.2.3', force: false },
    })
    expect(result.success).toBe(true)
  })

  // @UT-SYS-CORE-022@ (FROM: @IMP-SYS-CORE-004@)
  it('accepts a valid action without optional payload', () => {
    const result = NotificationActionSchema.safeParse({ label: 'OK', event: 'ui.ok' })
    expect(result.success).toBe(true)
  })

  // @UT-SYS-CORE-023@ (FROM: @IMP-SYS-CORE-004@)
  it('rejects an action missing the required label field', () => {
    const result = NotificationActionSchema.safeParse({ event: 'ui.ok' })
    expect(result.success).toBe(false)
  })
})

describe('NotificationSchema', () => {
  // @UT-SYS-CORE-024@ (FROM: @IMP-SYS-CORE-004@)
  it('accepts a valid minimal notification with required fields only', () => {
    const result = NotificationSchema.safeParse({
      id: 'INFO-SYS-001',
      severity: 'INFO',
      message: 'Update available',
    })
    expect(result.success).toBe(true)
  })

  // @UT-SYS-CORE-025@ (FROM: @IMP-SYS-CORE-004@)
  it('accepts a valid full notification with all optional fields', () => {
    const result = NotificationSchema.safeParse({
      id: 'CRIT-MB-001',
      severity: 'CRITICAL',
      message: 'CG Out of Envelope',
      context: 'MassBalance.CG',
      persistent: true,
      dismissible: false,
      action: { label: 'Review', event: 'ui.review', payload: { field: 'CG' } },
    })
    expect(result.success).toBe(true)
  })

  // @UT-SYS-CORE-026@ (FROM: @IMP-SYS-CORE-004@)
  it('defaults persistent to false and dismissible to true when omitted', () => {
    const result = NotificationSchema.safeParse({
      id: 'WARN-AC-001',
      severity: 'WARNING',
      message: 'Registration Duplicate',
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.persistent).toBe(false)
    expect(result.data.dismissible).toBe(true)
  })

  // @UT-SYS-CORE-027@ (FROM: @IMP-SYS-CORE-004@)
  it('rejects an invalid severity enum value', () => {
    const result = NotificationSchema.safeParse({
      id: 'X-001',
      severity: 'URGENT',
      message: 'msg',
    })
    expect(result.success).toBe(false)
  })

  // @UT-SYS-CORE-028@ (FROM: @IMP-SYS-CORE-004@)
  it('rejects a notification with a non-boolean persistent value', () => {
    const result = NotificationSchema.safeParse({
      id: 'X-002',
      severity: 'INFO',
      message: 'msg',
      persistent: 1,
    })
    expect(result.success).toBe(false)
  })

  // @UT-SYS-CORE-029@ (FROM: @IMP-SYS-CORE-004@)
  it('rejects a notification missing the required id field', () => {
    const result = NotificationSchema.safeParse({ severity: 'INFO', message: 'msg' })
    expect(result.success).toBe(false)
  })

  // @UT-SYS-CORE-030@ (FROM: @IMP-SYS-CORE-004@)
  it('rejects a notification missing the required severity field', () => {
    const result = NotificationSchema.safeParse({ id: 'X-003', message: 'msg' })
    expect(result.success).toBe(false)
  })
})

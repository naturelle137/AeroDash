import { watch } from 'vue'
import { convertLengthText, isLengthUnit, type LengthUnit } from '@/core/logic/unit-preferences'

/**
 * When the pilot changes a length unit, convert the entered number so it keeps the
 * same physical value instead of being relabelled. Programmatic fills (restore,
 * copy) pass through `suppressed()` and are never converted.
 */
export function convertOnLengthUnitChange<V extends string, U extends string>(
  draft: Record<V | U, string>, valueKey: V, unitKey: U, suppressed: () => boolean,
): void {
  watch(() => draft[unitKey], (to, from) => {
    if (suppressed() || !isLengthUnit(from) || !isLengthUnit(to)) return
    const converted = convertLengthText(draft[valueKey], from, to)
    if (converted !== null) draft[valueKey] = converted
  }, { flush: 'sync' })
}

/** A preference fills only units whose value is still blank; entered values keep their unit. */
export function applyPreferredUnit<V extends string, U extends string>(draft: Record<V | U, string>, valueKey: V, unitKey: U, unit: LengthUnit): void {
  if (draft[valueKey].trim() === '') draft[unitKey] = unit
}

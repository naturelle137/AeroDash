/**
 * AeroDash Supported Units — single source of truth for all accepted unit symbols.
 *
 * P1 Safety Core — consumed by UI, validation, and normalization layers.
 * @see REQ-SYS-004
 */

// @IMP-SYS-CORE-005@ (FROM: @REQ-SYS-004@)

/** Volume units accepted for storage, input, and display. */
export const VOLUME_UNITS = ['L', 'gal'] as const
/** Mass units accepted for storage, input, and display. */
export const MASS_UNITS = ['kg', 'lb'] as const
/** Speed units accepted for storage, input, and display. */
export const SPEED_UNITS = ['km/h', 'mph', 'kt', 'm/s'] as const
/** Arm (length / station) units accepted for storage, input, and display. */
export const ARM_UNITS = ['m', 'in', 'ft'] as const
/** Moment units accepted for storage, input, and display. */
export const MOMENT_UNITS = ['kg·m', 'in-lb', 'ft-lb'] as const
/** Temperature units accepted for storage, input, and display. */
export const TEMPERATURE_UNITS = ['°C', '°F'] as const
/** Altitude units accepted for storage, input, and display. */
export const ALTITUDE_UNITS = ['ft', 'm'] as const
/** Distance units accepted for storage, input, and display. */
export const DISTANCE_UNITS = ['km', 'mi', 'nm'] as const
/** Pressure units accepted for storage, input, and display. */
export const PRESSURE_UNITS = ['hPa', 'inHg', 'mmHg'] as const

export type VolumeUnit = (typeof VOLUME_UNITS)[number]
export type MassUnit = (typeof MASS_UNITS)[number]
export type SpeedUnit = (typeof SPEED_UNITS)[number]
export type ArmUnit = (typeof ARM_UNITS)[number]
export type MomentUnit = (typeof MOMENT_UNITS)[number]
export type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number]
export type AltitudeUnit = (typeof ALTITUDE_UNITS)[number]
export type DistanceUnit = (typeof DISTANCE_UNITS)[number]
export type PressureUnit = (typeof PRESSURE_UNITS)[number]

/** All unit symbols recognized by AeroDash, as a flat union type. */
export type SupportedUnit =
  | VolumeUnit
  | MassUnit
  | SpeedUnit
  | ArmUnit
  | MomentUnit
  | TemperatureUnit
  | AltitudeUnit
  | DistanceUnit
  | PressureUnit

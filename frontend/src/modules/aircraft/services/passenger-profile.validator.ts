import { PassengerProfileSchema, type AircraftProfilePassengerProfile } from '@/core/adapters/aircraft.schema'

export function validPassengerProfile(profile: AircraftProfilePassengerProfile): boolean {
  return profile.name.trim().length > 0 && PassengerProfileSchema.safeParse(profile).success
}

export type Locale = 'en' | 'de'

export interface InfoTerm {
  label: string
  explanation: string
}

// Generic definitions only: no aircraft values, no operational advice.
export const INFO_TERMS = {
  qnh: {
    en: { label: 'QNH', explanation: 'The aerodrome pressure setting, reduced to mean sea level using the standard atmosphere. With it set on the altimeter, the altimeter reads altitude above mean sea level.' },
    de: { label: 'QNH', explanation: 'Die auf Meereshöhe umgerechnete Luftdruckeinstellung eines Flugplatzes (Standardatmosphäre). Am Höhenmesser eingestellt, zeigt dieser die Höhe über dem Meeresspiegel an.' },
  },
  pressureAltitude: {
    en: { label: 'Pressure altitude', explanation: 'The altitude in the standard atmosphere that corresponds to the measured pressure, i.e. the altimeter reading with 1013.25 hPa set.' },
    de: { label: 'Druckhöhe', explanation: 'Die Höhe in der Standardatmosphäre, die dem gemessenen Luftdruck entspricht, also die Anzeige des Höhenmessers bei eingestellten 1013,25 hPa.' },
  },
  safetyFactor: {
    en: { label: 'Safety factor', explanation: 'A multiplier applied to a calculated distance to add margin. A value of 1.00 adds no margin.' },
    de: { label: 'Sicherheitsfaktor', explanation: 'Ein Multiplikator auf eine berechnete Strecke, der einen Puffer hinzufügt. Ein Wert von 1,00 fügt keinen Puffer hinzu.' },
  },
  distanceBasis: {
    en: { label: 'Ground roll vs. 50 ft distance', explanation: 'Ground roll is the distance on the runway from brake release to lift-off (take-off) or from touchdown to standstill (landing). The 50 ft distance is the total distance until the aircraft passes a 50 ft height above the runway (take-off) or from passing 50 ft until standstill (landing).' },
    de: { label: 'Rollstrecke vs. 50-ft-Strecke', explanation: 'Die Rollstrecke ist die Strecke auf der Bahn vom Bremslösen bis zum Abheben (Start) bzw. vom Aufsetzen bis zum Stillstand (Landung). Die 50-ft-Strecke ist die gesamte Strecke bis zum Erreichen von 50 ft Höhe über der Bahn (Start) bzw. vom Überfliegen von 50 ft bis zum Stillstand (Landung).' },
  },
  unverified: {
    en: { label: 'Unverified', explanation: 'The value or its source has not been checked and confirmed by the pilot. It is shown as entered and is not validated data.' },
    de: { label: 'Ungeprüft', explanation: 'Der Wert oder seine Quelle wurde vom Piloten nicht geprüft und bestätigt. Er wird wie eingegeben angezeigt und ist kein validierter Datensatz.' },
  },
  usableFuel: {
    en: { label: 'Usable and unusable fuel', explanation: 'Usable fuel is the fuel available for the engine under specified conditions. Unusable fuel is the quantity that cannot be used reliably and is excluded from the usable amount.' },
    de: { label: 'Ausfliegbarer und nicht ausfliegbarer Kraftstoff', explanation: 'Ausfliegbarer Kraftstoff steht dem Triebwerk unter festgelegten Bedingungen zur Verfügung. Nicht ausfliegbarer Kraftstoff kann nicht zuverlässig genutzt werden und ist nicht in der ausfliegbaren Menge enthalten.' },
  },
  reserveFuel: {
    en: { label: 'Reserve fuel', explanation: 'Reserve fuel is fuel planned to remain available beyond the trip fuel. The pilot must choose an appropriate reserve.' },
    de: { label: 'Reservekraftstoff', explanation: 'Reservekraftstoff ist Kraftstoff, der über den Streckenverbrauch hinaus verfügbar bleiben soll. Die Pilotin oder der Pilot muss eine geeignete Reserve wählen.' },
  },
  takeoffMass: {
    en: { label: 'Takeoff Mass', explanation: 'Takeoff mass is the aircraft mass at takeoff. Ramp mass is the mass before taxi and other ground fuel use.' },
    de: { label: 'Startmasse', explanation: 'Die Startmasse ist die Masse beim Start. Die Rollmasse ist die Masse vor dem Rollen und sonstigem Kraftstoffverbrauch am Boden.' },
  },
  zeroFuelMass: {
    en: { label: 'Zero Fuel Mass', explanation: 'Zero fuel mass (ZFM) is the aircraft mass excluding usable fuel; unusable fuel remains included.' },
    de: { label: 'Nullkraftstoffmasse', explanation: 'Die Nullkraftstoffmasse (ZFM) ist die Flugzeugmasse ohne ausfliegbaren Kraftstoff; nicht ausfliegbarer Kraftstoff bleibt enthalten.' },
  },
  centerOfGravity: {
    en: { label: 'Center of gravity', explanation: 'The center of gravity (CG) is the balance point. Its arm is the distance from the reference datum; moment is mass multiplied by arm. Mean aerodynamic chord (MAC) is a reference wing chord sometimes used to express CG as a percentage.' },
    de: { label: 'Schwerpunkt', explanation: 'Der Schwerpunkt (CG) ist der Gleichgewichtspunkt. Sein Hebelarm ist der Abstand von der Bezugsebene (Datum); das Moment ist Masse mal Hebelarm. Die mittlere aerodynamische Flügeltiefe (MAC) ist eine Bezugsflügeltiefe, auf die sich eine Schwerpunktangabe in Prozent beziehen kann.' },
  },
} as const satisfies Record<string, Record<Locale, InfoTerm>>

export type InfoTermId = keyof typeof INFO_TERMS

export function currentLocale(): Locale {
  const lang = (typeof document !== 'undefined' ? document.documentElement.lang : '') || (typeof navigator !== 'undefined' ? navigator.language : '')
  return lang.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function infoTerm(id: InfoTermId, locale: Locale = currentLocale()): InfoTerm {
  return INFO_TERMS[id][locale]
}

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
} as const satisfies Record<string, Record<Locale, InfoTerm>>

export type InfoTermId = keyof typeof INFO_TERMS

export function currentLocale(): Locale {
  const lang = (typeof document !== 'undefined' ? document.documentElement.lang : '') || (typeof navigator !== 'undefined' ? navigator.language : '')
  return lang.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function infoTerm(id: InfoTermId, locale: Locale = currentLocale()): InfoTerm {
  return INFO_TERMS[id][locale]
}

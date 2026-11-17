# Datenschutz und Schutz personenbezogener Daten

- Version: 1.5
- Datum: 2026-11-17
- Status: aktiv

[English](PRIVACY.md)

---

## 1. Überblick

AeroDash ist eine clientseitige Single-Page-Anwendung (SPA) zur Flugvorbereitung, die vorrangig offline arbeitet. Sie läuft vollständig im Browser des Nutzers. **Es werden keine personenbezogenen Daten, Luftfahrzeug- oder Sitzungsdaten an Server, Backends oder Dienste Dritter übertragen.** Es gibt weder Telemetrie noch Analysen, Tracking, Werbung oder Fernprotokollierung. Abgesehen vom Laden und Aktualisieren der Anwendung selbst (Anfragen an denselben Ursprung für die Anwendungshülle und den Aktualisierungszyklus des Service Workers) stellt die Anwendung genau **eine** Netzwerkanfrage auf Anwendungsebene: eine Online-Prüfung der sicheren Mindestversion (`GET /version.json`), die in [§7](#7-netzwerkaktivität-prüfung-der-sicheren-mindestversion) beschrieben wird. Diese enthält keine personenbezogenen Daten und dient ausschließlich als sicherheitsbezogener „Notausschalter“ (REQ-SYS-006 / H-019).

## 2. Erfasste Daten

Alle dauerhaft gespeicherten Daten liegen **lokal und unverschlüsselt auf dem Gerät** und werden **niemals an einen Server übertragen** (diese Version hat kein Backend). Die Speicherorte sind in §5 aufgeführt.

| Datenkategorie                       | Quelle                                     | Speicherort                                                    | Personenbezogene Daten enthalten?                                                                         |
| ------------------------------------ | ------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Luftfahrzeugprofile (Flotte)         | Vom Piloten eingegeben/importiert          | IndexedDB `aerodash-fleet`                                     | Ja — Kennzeichen, `ownerId`, Wägeberichte, `costPerHour` (lassen reale Luftfahrzeuge/Eigentümer erkennen) |
| Gespeicherte Sitzung (M&B-Eingaben)  | Vom Piloten während der Nutzung eingegeben | localStorage `aerodash:session:payload`                        | Nein — nur Stationsgewichte und Interaktionsmerkmale                                                      |
| Manuelle Start-/Landebahneingaben    | Vom Piloten während der Nutzung eingegeben | localStorage `aerodash.performance.manual-runway.v1`           | Nein — Flugplatz-/Bahnkennungen, deklarierte Strecken, Höhe und Oberflächenzustand                        |
| Kennzeichnung einer aktiven Sitzung  | Von der App beim Start gesetzt             | sessionStorage `aerodash.session.active`                       | Nein — eine einzelne Markierung `'1'` zur Erkennung eines PWA-Kaltstarts                                  |
| Oberflächeneinstellungen             | Vom Piloten ausgewählt                     | localStorage `aerodash-theme`, `aerodash.preferences.units.v1` | Nein — Darstellung und Anzeigeeinheiten                                                                   |
| Bestätigung des Haftungsausschlusses | Vom Piloten bestätigt                      | localStorage `aerodash.disclaimer.ack.v1`                      | Nein — akzeptierte Version/Bezugsstand und Bestätigungszeitpunkt                                          |
| Cache der sicheren Mindestversion    | Von der App verwaltet                      | IndexedDB `aerodash-app-version`                               | Nein — sichere Mindestversion und Cache-Zeitstempel                                                       |
| Berechnungsergebnisse                | Aus Eingaben berechnet                     | Nur im Arbeitsspeicher (nicht dauerhaft gespeichert)           | Nein                                                                                                      |

Es gibt keine persönlichen Konten, keine Authentifizierung und keine Cookies. Gespeicherte Sitzungs- und Flottendaten bleiben über das Neuladen der Seite hinaus erhalten, wie in §5 beschrieben.

## 3. Datenminimierung (DSGVO Art. 5 Abs. 1 Buchst. c)

Die Anwendung verarbeitet die für die Flugvorbereitung und ihre lokalen Steuerungsfunktionen erforderlichen Daten:

- Physikalische Luftfahrzeugparameter (Masse, Hebelarm, Hüllkurvengrenzen)
- Vom Nutzer eingegebene Stationsgewichte
- Abgeleitete Ergebnisse (Schwerpunktlage, Gesamtmasse, Grenzwertverletzungen)
- Manuelle Bahneingaben, Kraftstoff-/Flugleistungseingaben und optionale Betriebskostendaten
- Lokale Oberflächeneinstellungen, Bestätigung des Haftungsausschlusses und Zustand der Versionssicherheitsprüfung

Die Speicherung für lokale Steuerungsfunktionen und ihre Zwecke sind in §5 beschrieben; Berechnungsergebnisse verbleiben im Arbeitsspeicher.

### 3.1 Zuordnung von Zwecken zu Datenfeldern

Die Luftfahrzeug- und Vorbereitungsfelder sind nachfolgend ihrem jeweiligen Zweck, ihrer Rechtsgrundlage und den angewandten Maßnahmen zur Datenminimierung zugeordnet. Ein Feld wird nur gespeichert, wenn ein konkreter Zweck dies erfordert. Felder, die andernfalls beim Teilen eines Profils offengelegt würden, werden beim Export minimiert (siehe Zeile `costPerHour`).

| Feld                                      | Speicherort                                          | Zweck                                                                                                                                                                                                                                     | Rechtsgrundlage                                                                                         | Maßnahme zur Datenminimierung                                                                                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id` (Profil-UUID)                        | IndexedDB `aerodash-fleet`                           | Stabiler Schlüssel je Profil für Anlegen, Lesen, Ändern und Löschen in der Flotte, Auswahl des aktiven Luftfahrzeugs und kollisionsfreien Import.                                                                                         | Art. 6 Abs. 1 Buchst. b — erforderlich, um die vom Nutzer angeforderte Flottenfunktion bereitzustellen. | Zufällige UUID v4; nicht aus personenbezogenen Daten abgeleitet; beim Import neu erzeugt.                                                                                                              |
| `registration`                            | IndexedDB `aerodash-fleet`                           | Identifiziert das Luftfahrzeug für den Piloten und erzwingt eindeutige Kennzeichen je Eigentümer (REQ-AC-003). Potenzieller Personenbezug — ein Kennzeichen kann ein reales Luftfahrzeug und mittelbar dessen Eigentümer erkennen lassen. | Siehe [§3.2 Rechtsgrundlage für `registration`](#32-rechtsgrundlage-für-registration).                  | Vom Piloten für sein eigenes Luftfahrzeug eingegeben; niemals übertragen; durch Löschen des Flottenprofils oder Leeren des Browserspeichers löschbar.                                                  |
| `ownerId`                                 | IndexedDB `aerodash-fleet`                           | Beschränkt die Prüfung auf eindeutige Kennzeichen auf einen Eigentümer, sodass verschiedene Nutzer dasselbe Kennzeichen führen können (REQ-AD-019).                                                                                       | Art. 6 Abs. 1 Buchst. b — für die obige Eindeutigkeitsregel erforderlich.                               | Lokale, nicht sprechende Kennung; kein Kontensystem; niemals übertragen.                                                                                                                               |
| `weighingReports`                         | IndexedDB `aerodash-fleet`                           | Leermasse / Leerschwerpunkt / Wägedaten — die rechtliche Gewichtsgrundlage aller Masse- und Schwerpunktberechnungen (REQ-AD-004, REQ-AD-013).                                                                                             | Art. 6 Abs. 1 Buchst. b — zentrale Eingabe für die Sicherheitsberechnung.                               | Nur die für die M&B-Berechnung benötigten Felder werden gespeichert; Angaben zur Identität des Prüfers oder der Prüfstelle werden nicht erfasst.                                                       |
| `costPerHour`, `fuelCostIncluded`         | IndexedDB `aerodash-fleet`                           | Optionale Erfassung von Betriebskosten zur Flugkostenschätzung (REQ-AD-006). Wird in keiner Sicherheitsberechnung verwendet.                                                                                                              | Art. 6 Abs. 1 Buchst. a — freiwillige, optionale Komfortdaten, die der Pilot nach eigener Wahl eingibt. | Auf Schemaebene **optional**; **vom standardmäßigen Profilexport ausgeschlossen**, damit beim Teilen eines Profils keine Kostendaten offengelegt werden (REQ-AD-023; schließt Audit DP-008/DP-009 ab). |
| Gespeicherte Sitzungsdaten                | localStorage `aerodash:session:payload`              | Stellt die laufende M&B-Sitzung (ID des aktiven Luftfahrzeugs, Zulassungskategorie, Gewichte je Station) nach dem Neuladen der Seite wieder her (REQ-SYS-013).                                                                            | Art. 6 Abs. 1 Buchst. b — erforderlich, um ungesicherte Arbeit in einem Offline-Werkzeug zu bewahren.   | Keine personenbezogenen Daten außer dem Verweis auf die Luftfahrzeug-ID; bei Änderungen überschrieben; beim Luftfahrzeugwechsel gelöscht; bei fehlgeschlagener Validierung entfernt.                   |
| Manuelle Bahneingaben                     | localStorage `aerodash.performance.manual-runway.v1` | Stellt die vom Piloten deklarierten Bahnwerte auf diesem Gerät wieder her.                                                                                                                                                                | Art. 6 Abs. 1 Buchst. b — erforderlich, um eingegebene Vorbereitungsdaten offline zu bewahren.          | Keine personenbezogenen Daten; beim Speichern überschrieben; durch die Funktion zum Leeren oder die lokale Datenlöschung entfernt; bei Ungültigkeit ignoriert.                                         |
| Kennzeichnung einer aktiven Sitzung       | sessionStorage `aerodash.session.active`             | Einzelne Markierung `'1'` zur Unterscheidung zwischen PWA-Kaltstarts und Aktualisierungen während einer Sitzung.                                                                                                                          | Art. 6 Abs. 1 Buchst. f — berechtigtes Interesse am korrekten Verhalten bei Kaltstarts.                 | Enthält keine personenbezogenen Daten; wird automatisch beim Schließen des letzten Tabs gelöscht.                                                                                                      |
| Sonstige technische Luftfahrzeugparameter | IndexedDB `aerodash-fleet`                           | Beladungspunkte, Hüllkurve, Zulassungskategorien, Flugleistungs-/Wind-/Oberflächendaten — die technischen Eingaben für M&B- und Flugleistungsberechnungen.                                                                                | Art. 6 Abs. 1 Buchst. b — zentrale Berechnungseingaben.                                                 | Nicht personenbezogene technische Daten über das Luftfahrzeug, nicht über den Piloten.                                                                                                                 |

> **Hinweis zur Anwendbarkeit der DSGVO.** AeroDash ist ein lokales Offline-Werkzeug für einen einzelnen Nutzer, ohne Konten und ohne Datenübertragung. Verarbeitet ein Privatpilot Daten seines eigenen Luftfahrzeugs, kann die **Ausnahme für persönliche oder familiäre Tätigkeiten (Art. 2 Abs. 2 Buchst. c)** diese Verarbeitung vollständig aus dem sachlichen Anwendungsbereich der DSGVO ausnehmen. Die obigen Rechtsgrundlagen sind aus Transparenzgründen dokumentiert und sollen sinngemäß gelten, wenn ein Nutzer in einem nicht privaten Umfeld tätig ist (z. B. in einem kommerziell betriebenen Verein).

### 3.2 Rechtsgrundlage für `registration`

Das Luftfahrzeugkennzeichen `registration` (z. B. `D-EBPN`) ist dasjenige dauerhaft gespeicherte Feld, bei dem ein relevanter **potenzieller Personenbezug** besteht: Ein Kennzeichen kann mit einem öffentlichen Luftfahrzeugregister abgeglichen werden, um ein bestimmtes Luftfahrzeug und mittelbar dessen Halter zu identifizieren. AeroDash verarbeitet es auf folgender Grundlage:

- **Primäre Grundlage — Art. 6 Abs. 1 Buchst. b (Erfüllung der angeforderten Leistung):** Der Pilot gibt das Kennzeichen seines _eigenen_ Luftfahrzeugs ein, damit die App das Profil identifizieren, Ergebnisse beschriften und eindeutige Kennzeichen je Eigentümer sicherstellen kann (REQ-AC-003). Das Kennzeichen ist ein wesentlicher Bestandteil der vom Nutzer angeforderten Masse- und Schwerpunktaufgabe.
- **Ergänzende Grundlage — Art. 6 Abs. 1 Buchst. f (berechtigtes Interesse):** Luftfahrzeuge anhand ihres tatsächlichen Kennzeichens zu unterscheiden, ist für einen Piloten die naheliegendste und einfachste Möglichkeit, seine eigenen Profile wiederzuerkennen; keine weniger identifizierende Alternative würde diesen Zweck erfüllen.
- **Umfang und Schutzmaßnahmen:** Das Kennzeichen wird **lokal und unverschlüsselt** auf dem eigenen Gerät des Nutzers gespeichert und **niemals übertragen** (diese Version hat kein Backend). Es bleibt in Profilexporten enthalten, da es für ein nutzbares Luftfahrzeugprofil wesentlich ist, enthält aber keine zusätzlichen Kontakt- oder Identitätsdaten. Es kann jederzeit durch Löschen des Profils oder Leeren des Website-Speichers **gelöscht** werden (§5–§6). Soweit die Ausnahme für persönliche oder familiäre Tätigkeiten (Art. 2 Abs. 2 Buchst. c) greift, fällt das Kennzeichen nicht in den Anwendungsbereich der DSGVO.

## 4. Zweckbindung (DSGVO Art. 5 Abs. 1 Buchst. b)

Die von AeroDash verarbeiteten Daten dienen der Flugvorbereitung (M&B, Kraftstoff/Flugdauer und Flugleistung), der optionalen Flugkostenschätzung sowie den in §5 beschriebenen lokalen Oberflächen- und Sicherheitsfunktionen. Daten werden weder zweckentfremdet noch geteilt oder zusammengeführt.

## 5. Speicherung und Aufbewahrung (DSGVO Art. 5 Abs. 1 Buchst. e)

### Aktueller Stand

Diese Version speichert **tatsächlich** Daten auf dem Gerät. Sämtliche Speicherung erfolgt **lokal im Browser, unverschlüsselt und ohne Übertragung** — diese Version hat weder Backend noch Synchronisierung oder Fernprotokollierung. Drei Speichermechanismen werden verwendet:

1. **IndexedDB — Datenbank `aerodash-fleet`** (Objektspeicher `aircraft_profiles`).
   Enthält die gespeicherte Luftfahrzeugflotte des Piloten. Jedes Profil kann personenbezogene oder potenziell personenbeziehbare Daten enthalten: das Luftfahrzeugkennzeichen `registration`, eine `ownerId`, einen oder mehrere Wägeberichte (Leermasse, Leerschwerpunkt, Wägedaten) und optional `costPerHour`, neben den technischen M&B-/Flugleistungsparametern. Die Daten bleiben erhalten, bis der Pilot das Profil löscht, die Funktion _Alle Daten löschen_ in der App ausführt oder den Browserspeicher leert.
2. **localStorage — Schlüssel mit dem Präfix `aerodash`.**
   - `aerodash:session:payload` — automatisch gespeicherte Masse- und Schwerpunktsitzung (ID des aktiven Luftfahrzeugs, aktive Zulassungskategorie, Gewichte je Station mit Interaktionsmerkmalen). Keine personenbezogenen Daten außer dem Verweis auf die Luftfahrzeug-ID. Bei Änderungen überschrieben, beim Luftfahrzeugwechsel gelöscht und bei fehlgeschlagener Validierung entfernt.
   - `aerodash.performance.manual-runway.v1` — gespeicherte manuelle Bahneingaben.
   - `aerodash-theme` — Hell-/Dunkel-Einstellung des Piloten. Keine personenbezogenen Daten.
   - `aerodash.preferences.units.v1` — Anzeigeeinheiten; numerische QNH- und Druckhöheneingaben werden hier nicht gespeichert.
   - `aerodash.disclaimer.ack.v1` — akzeptierte App-Version, Bezugsstand des Haftungsausschlusses und Bestätigungszeitpunkt; bestimmt, ob eine erneute Bestätigung erforderlich ist.
   - Die Funktion _Alle Daten löschen_ erfasst Schlüssel, die genau `aerodash` lauten oder mit `aerodash-`, `aerodash:` oder `aerodash.` beginnen (ohne Beachtung der Groß-/Kleinschreibung), nicht jedoch fremde Präfixe wie `aerodashboard`. Dieselbe Regel gilt für sessionStorage.
3. **sessionStorage — Schlüssel `aerodash.session.active`.**
   Eine einzelne Markierung `'1'`, die ausschließlich dazu dient, PWA-Kaltstarts von Aktualisierungen während einer Sitzung zu unterscheiden. Sie enthält keine personenbezogenen Daten, wird automatisch beim Schließen des letzten Tabs für diesen Ursprung gelöscht und auch durch die Funktion _Alle Daten löschen_ in der App entfernt.

Der Cache der sicheren Mindestversion verwendet zusätzlich **IndexedDB `aerodash-app-version`**, Objektspeicher `version_policy`, Datensatz `minSafeVersion`. Er speichert die sichere Mindestversion und den Zeitstempel `fetchedAt`, um die Versionsgrenze offline durchzusetzen. Die Funktion _Alle Daten löschen_ in der App leert diese separate Datenbank nicht; das Löschen der Website-Daten im Browser kann sie entfernen. Der Service Worker speichert außerdem Anwendungsdateien für die Offline-Nutzung zwischen; diese Caches sind keine Flotten-/Sitzungsdaten und werden durch diese Funktion nicht geleert.

**Heutige Steuerungsmöglichkeiten:** AeroDash bietet unter `/privacy` eine eigene **Datenschutzansicht** mit zwei an der DSGVO ausgerichteten Funktionen:

1. **JSON-Sammelexport (Art. 15 / Art. 20).** Lädt jedes _lesbare_ Luftfahrzeugprofil in einer einzigen JSON-Datei mit Schemaversion herunter (`aerodash-fleet-<timestamp>.json`). Kann die laufende Version ein gespeichertes Profil nicht lesen (z. B. weil es nach einem Zurücksetzen des PWA-Caches von einer neueren App-Version geschrieben wurde), wird es nicht in die Datei aufgenommen. **Die Exportansicht warnt, wie viele Profile ausgelassen wurden**, sodass die Kopie niemals unbemerkt unvollständig ist — aktualisieren Sie AeroDash, um diese Profile vor dem Löschen wiederherzustellen.
2. **Alle Daten löschen (Art. 17).** Leert nach ausdrücklicher Bestätigung (Eingabe einer Bestätigungsphrase) den gesamten IndexedDB-Speicher `aerodash-fleet` sowie die oben definierten Schlüssel im Namensraum von localStorage und sessionStorage. Die Funktion arbeitet nach bestem Bemühen über alle drei Speichermechanismen hinweg — ein Fehler in einem Speicher verhindert die weiteren Versuche nicht, damit möglichst viele Daten entfernt werden. Gemeldete Löschfehler führen zu einem kritischen Hinweis anstelle einer Erfolgsmeldung. Versuchen Sie es erneut und verwenden Sie bei anhaltenden Fehlern die Browserfunktion „Website-Daten löschen“ für den AeroDash-Ursprung. Ein fehlender oder nicht zugänglicher localStorage-/sessionStorage-Speicher wird ohne Fehlermeldung übersprungen. Eine Erfolgsmeldung belegt daher nicht, dass unzugänglicher Speicher geprüft oder geleert wurde.

**Zur Aufbewahrung (Art. 5 Abs. 1 Buchst. e):** AeroDash löscht gespeicherte Daten nicht automatisch nach einer Frist. Eine Aufbewahrungsfrist begrenzt die Speicherdauer personenbezogener Daten im Verhältnis zu ihrem Erhebungszweck — sie richtet sich _nicht_ nach dem Alter des Wägeberichts eines Luftfahrzeugs (eine Leermasse kann über Jahre gültig und in aktiver Nutzung bleiben). Da derzeit kein Inaktivitätssignal erfasst wird, könnte eine automatische altersabhängige Löschung Daten zerstören, auf die der Pilot weiterhin angewiesen ist. Deshalb steuert der Pilot die Aufbewahrung über die Löschung einzelner Profile und die oben beschriebene Funktion _Alle Daten löschen_, anstatt über eine zeitgesteuerte Bereinigung.

Einzelne Luftfahrzeugprofile können weiterhin in der Flottenansicht gelöscht werden. Der Pilot kann auch außerhalb der App alle gespeicherten Daten entfernen, indem er den Browserspeicher der Website leert (Browsereinstellungen → Website-Daten / „Website-Daten löschen“ für den AeroDash-Ursprung).

**Verbleibendes Offenlegungsrisiko:** Da die Speicherung lokal und unverschlüsselt erfolgt, kann jeder mit Zugriff auf das Browserprofil des Geräts die gespeicherte Flotte (einschließlich Kennzeichen und Eigentümerkennungen) lesen, **bis** der Pilot die obige Funktion _Alle Daten löschen_ ausführt. Dies ist für ein lokales Offline-Werkzeug für einen einzelnen Nutzer akzeptabel, wird hier jedoch aus Transparenzgründen dokumentiert.

### Künftige Versionen

Folgende Maßnahme bleibt **geplant, ist aber noch nicht umgesetzt**:

1. **Keine Serversynchronisierung ohne Einwilligung:** Wird eine Cloud-Synchronisierung hinzugefügt (Meilenstein #7), verlassen Daten das Gerät erst nach ausdrücklicher Zustimmung und Authentifizierung des Nutzers.

## 6. Rechte betroffener Personen (DSGVO Art. 15–20)

### Aktueller Stand

Personenbezogene Daten werden lokal auf dem Gerät gespeichert (siehe §5), aber niemals übertragen. Es gibt keine Konten. Die betroffene Person ist der einzige Nutzer des Geräts und hat die volle physische Kontrolle über die Daten:

- **Auskunftsrecht (Art. 15):** Alle gespeicherten Daten liegen auf dem eigenen Gerät des Nutzers. Luftfahrzeugprofile sind in der Flottenansicht einsehbar. Der _JSON-Sammelexport_ in der Datenschutzansicht (`/privacy`) erzeugt eine maschinenlesbare Ausgabe der gesamten Flotte.
- **Recht auf Berichtigung (Art. 16):** Luftfahrzeugprofile können in der App bearbeitet werden (Flotte → Bearbeiten; der Zustandsautomat für Entwurf/Verifiziert protokolliert, wer die jeweilige Revision eingebracht hat).
- **Recht auf Löschung (Art. 17):** Einzelne Profile können in der Flottenansicht gelöscht werden. Die Funktion _Alle Daten löschen_ in der Datenschutzansicht löscht in einem einzigen bestätigten Vorgang die gesamte Flotte sowie die in §5 beschriebenen Schlüssel im Namensraum von localStorage/sessionStorage, unter den dort genannten Einschränkungen.
- **Recht auf Datenübertragbarkeit (Art. 20):** Der Import-/Exportablauf für Einzelprofile auf den jeweiligen Flottenkarten verarbeitet weiterhin jeweils ein Profil. Der _JSON-Sammelexport_ in der Datenschutzansicht erzeugt eine gemeinsame Datenhülle aller Profile in einer Datei mit Schemaversion, geeignet zur Archivierung oder Übertragung auf ein anderes Gerät.

- **JSON-Sammelimport (Art. 20).** Die Flottenansicht kann einen Sammelexport nach Dateiauswahl, Vorschau und ausdrücklicher Bestätigung wiederherstellen. Dabei werden neue, unverifizierte Entwürfe hinzugefügt, ohne vorhandene Luftfahrzeuge zu überschreiben; Kennzeichenkonflikte blockieren die Wiederherstellung. Der Einzelprofilimport bleibt verfügbar.

### Künftige Versionen

Folgendes bleibt **geplant, ist aber noch nicht umgesetzt**:

- Einstieg in die Cloud-Synchronisierung (Meilenstein #7). Die lokale Wiederherstellung von Sammelsicherungen ist bereits verfügbar und benötigt keine Cloud-Synchronisierung.

## 7. Netzwerkaktivität (Prüfung der sicheren Mindestversion)

AeroDash arbeitet vorrangig offline und stellt im Offline-Zustand **keine** Netzwerkanfragen. Wenn die Anwendung **bei bestehender Internetverbindung** startet oder die Verbindung wiederhergestellt wird, stellt sie neben dem Laden und Aktualisieren der Anwendung selbst genau **eine** Anfrage auf Anwendungsebene: eine HTTP-`GET`-Anfrage an `/version.json`, bereitgestellt vom **selben Ursprung** wie die App. Diese Prüfung der _sicheren Mindestversion_ erfüllt REQ-SYS-006 und mindert die Gefährdung H-019: Sie ermöglicht es, eine unsichere Version nach Entdeckung eines sicherheitskritischen Fehlers nach der Veröffentlichung zu sperren (ein entfernter „Notausschalter“). Die vollständige Datenschutzanalyse ist in [ADR-011](docs/architecture/adr/011-min-safe-version-fetch-privacy.md) dokumentiert.

- **Was die Anfrage sendet:** nichts, was AeroDash hinzufügt. Sie enthält keine Cookies oder Zugangsdaten (`credentials: 'omit'`), keinen Anfragekörper, keine von AeroDash gesetzten Header, keine Abfrageparameter und keine Geräte-, Installations- oder Nutzerkennung. Luftfahrzeug-, Flotten- oder Sitzungsdaten sind nicht enthalten.
- **Was dennoch beobachtbar ist:** Wie bei jeder HTTPS-Anfrage kann der Server Ihre **IP-Adresse**, den standardmäßigen **User-Agent** des Browsers und den Zeitpunkt der Anfrage erkennen (ungefähr, wann Sie die App online geöffnet haben). Bei selbst gehosteten Bereitstellungen oder solchen mit einem einzigen Ursprung ist dies derselbe Ursprung, der Ihnen bereits die App ausgeliefert hat; die Prüfung bezieht daher keinen Dritten ein. Die Anfrage verwendet `referrerPolicy: 'no-referrer'`, um den Header **`Referer`** zu unterdrücken.
- **Wann sie ausgelöst wird:** nur wenn das Gerät eine bestehende Internetverbindung meldet — beim App-Start und bei Wiederherstellung der Verbindung. Die Prüfung erfolgt nach bestem Bemühen; jeder Fehler wird ignoriert und die App behält die zuletzt bekannte Untergrenze für die sichere Version bei.
- **Deaktivierung:** Da diese Prüfung eine _Sicherheitsmaßnahme_ ist, gibt es bewusst keinen Schalter in der App, um sie zu deaktivieren — eine Abschaltung würde es einer bekanntermaßen unsicheren Version erlauben, weiterzulaufen (Gefährdung H-019). Wenn Sie keinerlei ausgehende Anfragen wünschen, können Sie die App vollständig offline betreiben (es wird keine Anfrage gestellt), den Endpunkt auf Netzwerkebene sperren oder den Ursprung selbst hosten, sodass die Metadaten Ihre eigene Infrastruktur nicht verlassen.

## 8. Abhängigkeiten von Drittanbietern

- Es sind keine Bibliotheken Dritter für Analysen, Werbung oder Tracking enthalten.
- Abgesehen vom Laden und Aktualisieren der Anwendung selbst ist die einzige Netzwerkanfrage der App die in §7 beschriebene Versionssicherheitsprüfung an denselben Ursprung des eigenen Anbieters; kein Dienst eines Drittanbieters wird kontaktiert.
- Die Laufzeitabhängigkeiten beschränken sich auf Vue.js, Pinia, Vue Router, Zod und `uuid`.
- Die Sicherheit der Abhängigkeiten wird durch Dependabot und `pnpm audit` in der CI überwacht.

## 9. Sicherheitsmaßnahmen

- Die auf Offline-Nutzung ausgerichtete Architektur minimiert die netzwerkbasierte Angriffsfläche; die einzige ausgehende Anfrage (§7) ist eine `GET`-Anfrage an denselben Ursprung ohne Zugangsdaten, die nie mehr als eine kleine, begrenzte Antwortmenge liest.
- Eingabevalidierung durch Zod-Schemas an der Adaptergrenze.
- Es werden keine Zugangsdaten, Tokens oder Geheimnisse in der Anwendung gespeichert.
- Die CI-Pipeline erzwingt unveränderte Lockfiles und die Sicherheitsprüfung der Abhängigkeiten.

## 10. Kontakt

Bei Fragen zum Datenschutz eröffnen Sie bitte ein Issue im Projekt-Repository mit dem Label `privacy`.

# AeroDash

[![en](https://img.shields.io/badge/lang-en-green.svg)](README.md)

## Inhaltsverzeichnis

* [Haftungsausschluss](#disclaimer)
* [Projektphilosophie](#philosophy)
* [Verwendungszweck & Systemgrenzen](#intendedUse)
* [Lizenz](#license)

<a name="disclaimer"></a>

## ⚠️ Haftungsausschluss

**KEIN ZERTIFIZIERTES LUFTFAHRTGERÄT.**

WICHTIG: AeroDash ist ein Open-Source-Tool zur Flugvorbereitung, das ausschließlich für Bildungs- und Informationszwecke entwickelt wurde. Es ist **KEIN** Ersatz für zertifizierte Luftfahrt-Datenquellen (AIP, AFM/POH, offizielle Wetterberatungen). **NUTZUNG AUF EIGENE GEFAHR!** Bitte lies den vollständigen [Haftungsausschluss](DISCLAIMER.md#deutsch).

* **KEINE GEWÄHRLEISTUNG:** Die Software wird "wie besehen" (as is) zur Verfügung gestellt, ohne jegliche Gewährleistung.
* **VERANTWORTUNG DES PILOTEN:** Der verantwortliche Luftfahrzeugführer (PIC) trägt die alleinige Verantwortung für die sichere Durchführung des Fluges und die Überprüfung aller berechneten Daten anhand des offiziellen Flughandbuchs (AFM).
* **DATENGÜLTIGKEIT:** Die Berechnungsergebnisse hängen vollständig von den Benutzereingaben und der Genauigkeit der hinterlegten Flugzeugprofile ab.

---

<a name="philosophy"></a>

## Projektphilosophie

> **"Nicht raten. Wissen. Präzision auf Luftfahrt-Niveau für souveräne Entscheidungen."**

Dieser Leitsatz prägt jede architektonische Entscheidung in AeroDash:

### 🎯 Vision

Die "Schätzung" aus der Flugvorbereitung der Allgemeinen Luftfahrt (General Aviation) zu eliminieren, indem ein Werkzeug bereitgestellt wird, das so zuverlässig ist wie das Flugzeug selbst.

### 🛡️ Grundwerte

#### 1. Autorität des Piloten

* Die Software ist ein Berater, niemals der Kommandant.
* Wir bieten **Entscheidungshilfe**, keine Entscheidungsfindung.
* Wir warnen optisch vor kritischen Zuständen, lassen aber manuelle Übersteuerungen für abnormale Flugbetriebszustände zu.

#### 2. Konservative Präzision

* Wir bevorzugen konservative Annäherungen gegenüber optimistischer Exaktheit. Rundungen werden immer zur sicheren Seite hin vorgenommen.
* Wenn das POH sagt, dass es knapp wird, sagen wir dir, dass es knapp wird. Wir ziehen einen abgesagten Flug einem kalkulierten Risiko vor.
* Berechnungen basieren auf verifizierter Physik und anerkannten Luftfahrtstandards, nicht auf UI-Bequemlichkeit.

#### Nachweise

* Berechnungen brauchen klare Eingaben, Grenzen und unabhängig geprüfte Referenzfälle. Synthetische Tests ersetzen keine Prüfung realer POH-/AFM-Daten.

<a name="intendedUse"></a>

## Verwendungszweck & Systemgrenzen

### 1. Was AeroDash IST

AeroDash ist ein spezialisiertes **Tool zur Flugvorbereitung und Entscheidungshilfe** für Piloten der Allgemeinen Luftfahrt, die nach **EASA Part-NCO** Regeln operieren. Sein Hauptzweck ist es, die Durchführbarkeit eines geplanten Fluges hinsichtlich Masse & Schwerpunkt (Mass & Balance) sowie Start- und Landeleistung vor dem Anlassen des Motors zu bestimmen.

#### Kernfunktionen

* **Go/No-Go Entscheidungshilfe:** Soll anhand eingegebener Daten prüfen, dass sich das Flugzeug innerhalb der zertifizierten Grenzen für Masse, Schwerpunkt (CG) und Leistung unter den erwarteten Umweltbedingungen befindet.
* **Flugzeugspezifische Daten:** Arbeitet mit den exakten Daten einer spezifischen Zelle (basierend auf dem individuellen Wägebericht und POH), nicht mit generischen Typdaten.
* **Ziel der Leistungsberechnung:** POH-Interpolation mit anwendbaren dokumentierten Korrekturfaktoren verbinden. Performance zeigt derzeit vier unkorrigierte POH-Distanzen innerhalb vollständiger Tabellengrenzen.
* **Fuel & Endurance:** Die Flugvorbereitung nutzt verfügbare M&B-Tankmengen abzüglich unbrauchbaren Kraftstoffs mit expliziten Verbrauchs-/Zeit-/Reserveeingaben oder direktem Trip Fuel in kg. Sie zeigt geschätzte Ankunftsmasse und bei Tanks mit festem Hebelarm ohne Nachschlagetabelle (ein Tank oder explizit gewählte vollständige benannte Entnahmereihenfolge) den geschätzten Ankunftsschwerpunkt in Metern. Nicht unterstützter Schwerpunkt erhält eine Begründung; gültige Massen bleiben verfügbar. Der Zeitmodus zeigt außerdem Ausdauer, Bedarf und Fehlmengen; die Reserve bleibt an Bord. Keine Bewertung der Landeeignung oder des gesamten Verbrauchspfads/der Hüllkurve. Eingaben werden bei Flugzeug-/Methodenwechsel, Verlassen der Ansicht und Neuladen gelöscht. Die Reihenfolge wird bei Profil-/Kategorie-/Methodenwechsel und Neuladen zurückgesetzt. Variabler Tankhebelarm, Bewertung des gesamten Verbrauchspfads und elektrische Ausdauer bleiben offen.

#### Zielgruppe & Kontext

* **Flugzeuge:** Einmotorige Kolbenflugzeuge (SEP), z. B. Diamond DA40, Tecnam P2008, Klemm KL 107.
* **Flugregeln:** VFR (Sichtflug) und privater IFR-Betrieb.
* **Nutzer:** Freizeitpiloten und Fliegerclubs.

### 2. Was AeroDash NICHT ist

AeroDash schließt ausdrücklich Funktionen aus, die außerhalb des Bereichs der Pre-Flight Performance-Berechnung liegen. Es ist **kein** zertifiziertes Electronic Flight Bag (EFB) für die Navigation oder primäre Flugführung.

#### Funktionale Ausschlüsse

* **Keine In-Flight Navigation:** Das System bietet keine beweglichen Karten (Moving Maps), Luftraumwarnungen oder Echtzeit-Verkehrsinformationen.
* **Keine Routenplanung:** Es berechnet keine Steuerkurse, Geschwindigkeiten über Grund oder Windvorhaltewinkel für Navigationsabschnitte. Der Trip-Fuel muss extern berechnet werden; AeroDash prüft lediglich, ob die Tankkapazität den Bedarf deckt.
* **Kein Briefing-Service:** Es ersetzt nicht das vorgeschriebene Pre-Flight Briefing. Es liefert keine NOTAMs, GAFOR oder synoptischen Wetterkarten.

#### Operative Ausschlüsse

* **Kein gewerblicher oder komplexer Betrieb:** Nicht vorgesehen für den gewerblichen Luftverkehr (CAT), den nicht-gewerblichen Betrieb mit komplexen Motorflugzeugen (NCC) oder Hochleistungsflugzeuge (HPA).
* **Keine Unterstützung für mehrmotorige Flugzeuge:** Die aktuelle Physik-Engine berücksichtigt keine asymmetrischen Schub-Szenarien oder Berechnungen der Startabbruchstrecke (Balanced Field Length).

### Eingeschränkte Nutzung während des Fluges (nur Notfälle)

Obwohl das System für die Vorbereitung vor dem Flug konzipiert ist, darf es während des Fluges ausschließlich für die **Notfallplanung** verwendet werden (z. B. Berechnung von Landedistanzen für eine ungeplante Ausweichlandung). Dabei muss der Pilot dem Fliegen des Flugzeugs (`Aviate`) stets Vorrang vor der Bedienung der Software einräumen.

### 3. Autorität des verantwortlichen Luftfahrzeugführers
>
> **"Die Software rechnet, der Pilot entscheidet."**

AeroDash verarbeitet Daten basierend auf Benutzereingaben. Es kann die physische Realität nicht überprüfen. Der verantwortliche Luftfahrzeugführer (PIC) trägt die alleinige Verantwortung für:

1. Die Überprüfung, ob die Profilparameter des Flugzeugs mit dem physischen AFM/POH übereinstimmen.
2. Sicherstellung, dass die Eingabewerte (Gewicht, Temperatur, Wind) die Realität widerspiegeln.
3. Anwendung zusätzlicher Sicherheitsmargen, wie sie die gute Seemannschaft (Airmanship) erfordert.

<a name="license"></a>

## Lizenz

Für AeroDash gilt **Doppellizenzierung**:

* **Quellcode** (z. B. die Anwendung unter `frontend/`, Skripte und Konfiguration zum Bauen und Ausführen der Software) steht unter der **[European Union Public Licence (EUPL) v. 1.2](LICENSE)** (englischer Vertragstext).
* **Dokumentation** (Markdown unter `docs/` sowie Markdown im Repository-Root wie dieses README, Anforderungen, Journeys und Leitfäden) steht unter **[Creative Commons Attribution-ShareAlike 4.0 International](LICENSE-DOCUMENTATION)** (CC BY-SA 4.0).

## Aktueller Funktionsumfang

Lokale Flugzeugverwaltung, Massen-/Schwerpunkt-Workflow und POH-Tabellenabfrage sind vorhanden. Eigene belegte Tabellen in Fleet importieren, Originalpunkte und normalisierte Werte prüfen (Quelleneinheiten: kg/lb, ft/m, °C/°F, m/ft), den Draft ausdrücklich verifizieren und den Stand in Performance mit kg/ft/°C abfragen. Ungültige Eingaben und Werte außerhalb der Tabellen bleiben gesperrt. Performance speichert außerdem offline eine selbst eingegebene Piste (TORA/LDA, Platzhöhe, Oberflächenzustand, ausdrücklich m/ft); sie ist nicht mit Flugplatzdaten geprüft und wird noch nicht verglichen. Keine Standard-Leistungstabellen, Betriebsfaktoren oder Pistenbewertung werden bereitgestellt. Wetter und elektrische Ausdauer sind noch Platzhalter. Die Flugvorbereitung bietet eine offlinefähige M&B-Druckvorschau mit aktuellen Warnungen und Profilstatus sowie der nativen Browser-Druckfunktion. Eingabeänderungen verwerfen die Vorschau. Der Endpunkt nach Verbrauch des gesamten nutzbaren Kraftstoffs ist keine flugspezifische Ankunft oder Eignungsbewertung. PDF-Download, vollständiges Briefing-Paket, Performance-Export, Flughafenintegration und Cloud-Synchronisation bleiben geplant. Synthetische Tests belegen die Verdrahtung, keine Prüfung realer Flugzeugdaten. Die [Roadmap](docs/development/roadmap.md) trennt diese Stände vom vollständigen Produktziel.

## Entwicklung und Dokumentation

Node >=22.12 und Corepack/pnpm verwenden: `pnpm install --frozen-lockfile`, danach `pnpm dev` (Port 5173). Prüfungen: `pnpm lint && pnpm test:unit`, Browser: `pnpm test:e2e --project=chromium`.

[AGENTS.md](AGENTS.md), [Beitragen](CONTRIBUTING.md), [Architektur](ARCHITECTURE.md), [Anforderungen](docs/requirements/README.md) und [Tests](docs/testing/TESTING.md) sind die zentralen Entwicklerdokumente auf Englisch. README.md bleibt Englisch, README-DE.md Deutsch.

**Kraftstoff und Flugzeit:** Die Flugvorbereitung verwendet verfügbare Tankmengen abzüglich nicht ausfliegbaren Kraftstoffs. Durchschnittsverbrauch (kg/h), Flugzeit und Reserve (Minuten) werden ausdrücklich eingegeben. Die Anzeige berechnet Reichweite in Minuten, Bedarf und Fehlmenge bei konstantem Verbrauch; sie gibt keine regulatorische Mindestreserve oder Flugfreigabe vor. Die neuen Eingaben werden beim Flugzeugwechsel, Verlassen der Ansicht oder Neuladen gelöscht. Flugbezogene Landemasse/Schwerpunkt und elektrische Ausdauer bleiben offen.

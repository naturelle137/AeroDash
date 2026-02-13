# AeroDash

[![en](https://img.shields.io/badge/lang-en-green.svg)](README.md)

## Inhaltsverzeichnis
* [Haftungsausschluss](#️-disclaimer)
* [Projektphilosophie](#philosophy)
* [Verwendungszweck & Systemgrenzen](#intendedUse)

## <a name="disclaimer"></a>⚠️ Haftungsausschluss

**KEIN ZERTIFIZIERTES LUFTFAHRTGERÄT.**

WICHTIG: AeroDash ist ein Open-Source-Tool zur Flugvorbereitung, das ausschließlich für Bildungs- und Informationszwecke entwickelt wurde. Es ist **KEIN** Ersatz für zertifizierte Luftfahrt-Datenquellen (AIP, AFM/POH, offizielle Wetterberatungen). **NUTZUNG AUF EIGENE GEFAHR!** Bitte lies den vollständigen [Haftungsausschluss](DISCLAIMER.md).

* **KEINE GEWÄHRLEISTUNG:** Die Software wird "wie besehen" (as is) zur Verfügung gestellt, ohne jegliche Gewährleistung.
* **VERANTWORTUNG DES PILOTEN:** Der verantwortliche Luftfahrzeugführer (PIC) trägt die alleinige Verantwortung für die sichere Durchführung des Fluges und die Überprüfung aller berechneten Daten anhand des offiziellen Flughandbuchs (AFM).
* **DATENGÜLTIGKEIT:** Die Berechnungsergebnisse hängen vollständig von den Benutzereingaben und der Genauigkeit der hinterlegten Flugzeugprofile ab.

---

## <a name="philosophy"></a>Projektphilosophie

> **"Nicht raten. Wissen. Präzision auf Luftfahrt-Niveau für souveräne Entscheidungen."**

Dieser Leitsatz prägt jede architektonische Entscheidung in AeroDash:

### 🎯 Vision
Die "Schätzung" aus der Flugvorbereitung der Allgemeinen Luftfahrt (General Aviation) zu eliminieren, indem ein Werkzeug bereitgestellt wird, das so zuverlässig ist wie das Flugzeug selbst.

### 🛡️ Grundwerte

**1. Autorität des Piloten**
* Die Software ist ein Berater, niemals der Kommandant.
* Wir bieten **Entscheidungshilfe**, keine Entscheidungsfindung.
* Wir warnen optisch vor kritischen Zuständen, lassen aber manuelle Übersteuerungen für abnormale Flugbetriebszustände zu.

**2. Konservative Präzision**
* Wir bevorzugen konservative Annäherungen gegenüber optimistischer Exaktheit. Rundungen werden immer zur sicheren Seite hin vorgenommen.
* Wenn das POH sagt, dass es knapp wird, sagen wir dir, dass es knapp wird. Wir ziehen einen abgesagten Flug einem kalkulierten Risiko vor.
* Berechnungen basieren auf verifizierter Physik und anerkannten Luftfahrtstandards, nicht auf UI-Bequemlichkeit.

**3. Rückverfolgbarkeit**
* Vertrauen wird durch Transparenz verdient. Es gibt keine "verborgene Magie" – jede Ausgabe in AeroDash ist auf eine spezifische Anforderung und eine verifizierte Datenquelle rückverfolgbar.
* Alle Gefahren, die sich aus der Nutzung von AeroDash ergeben könnten, werden verstanden und minimiert.

---

## <a name="intendedUse"></a>Verwendungszweck & Systemgrenzen

### 1. Was AeroDash IST
AeroDash ist ein spezialisiertes **Tool zur Flugvorbereitung und Entscheidungshilfe** für Piloten der Allgemeinen Luftfahrt, die nach **EASA Part-NCO** Regeln operieren. Sein Hauptzweck ist es, die Durchführbarkeit eines geplanten Fluges hinsichtlich Masse & Schwerpunkt (Mass & Balance) sowie Start- und Landeleistung vor dem Anlassen des Motors zu bestimmen.

#### Kernfunktionen
* **Go/No-Go Entscheidungshilfe:** Liefert den mathematischen Nachweis, dass sich das Flugzeug innerhalb der zertifizierten Grenzen für Masse, Schwerpunkt (CG) und Leistung unter den erwarteten Umweltbedingungen befindet.
* **Flugzeugspezifische Daten:** Arbeitet mit den exakten Daten einer spezifischen Zelle (basierend auf dem individuellen Wägebericht und POH), nicht mit generischen Typdaten.
* **Hybride Leistungsberechnung:** Kombiniert POH-Tabelleninterpolation mit standardisierten Sicherheitsfaktoren (z. B. FSM 3/75), um konservative Distanzschätzungen für unbefestigte oder kontaminierte Start- und Landebahnen zu liefern.
* **Einfacher Reichweitencheck:** Berechnet die "Time to Empty" basierend auf den vom Benutzer eingegebenen Kraftstoffmengen, um zu validieren, ob die Ausdauer die geplante Flugzeit plus Reserven überschreitet.

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
> **"Die Software rechnet, der Pilot entscheidet."**

AeroDash verarbeitet Daten basierend auf Benutzereingaben. Es kann die physische Realität nicht überprüfen. Der verantwortliche Luftfahrzeugführer (PIC) trägt die alleinige Verantwortung für:
1. Die Überprüfung, ob die Profilparameter des Flugzeugs mit dem physischen AFM/POH übereinstimmen.
2. Sicherstellung, dass die Eingabewerte (Gewicht, Temperatur, Wind) die Realität widerspiegeln.
3. Anwendung zusätzlicher Sicherheitsmargen, wie sie die gute Seemannschaft (Airmanship) erfordert.
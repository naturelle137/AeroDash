# Environmental correction source acquisition

Research snapshot: 2026-11-13; AeroDash develop `0446487377023bafacbf9384115fb5f9d0fe60ac`.
Internal engineering dossier for [#305](https://github.com/naturelle137/AeroDash/issues/305) and [#300](https://github.com/naturelle137/AeroDash/issues/300). Acquisition evidence is not operational acceptance.

## Kurzfassung für den CEO

Das originale Tecnam-P2008-JC-Flughandbuch, der historische FSM-3/75-Nachdruck und eine aktuelle britische CAA-Alternative wurden beschafft und relevante Originalseiten geprüft. Es gibt belastbare Recherchegrundlagen, aber noch keine allgemein freigegebene Korrekturberechnung: Die Quellen unterscheiden sich bei Bezugsstrecke, Grundoberfläche und Rechenart. Empfehlung: #305 zunächst auf eine ausdrücklich passende Flugzeugkonfiguration begrenzen und fehlende Anwendbarkeit sichtbar sperren. Keine Produktdaten wurden geändert; die Quellen ersetzen niemals fehlende POH-Grundtabellen.

## Evidence and reproduction

The private acquisition bundle is in HQ job `613/input/`: four PDFs, layout-preserving text, rendered pages and `manifest.json` with byte counts, hashes and PDF metadata. The complete dossier is also copied to the job directory. PDFs and page images are deliberately excluded from the product repository. All four downloads occurred on 2026-11-13 UTC. Page numbers below are printed labels; PDF page numbers are one-based.

| ID | Primary document and acquisition URL | Version and inspected location | Origin qualification |
| :-- | :-- | :-- | :-- |
| T | [Tecnam P2008 JC AFM](https://www.skyservices-flightacademy.com/wp-content/uploads/2020/08/Aircraft_Flight_Manual_b_I-SKYP_Ed2r7.pdf) | 2008/100, Ed.2 Rev.7, 30 July 2020; 0-1/0-7, 1-6, 5-2, 5-7/5-14; S4-17, 5W-7/5W-15 (PDF 264/272/280) | Manufacturer-authored original, flight-school mirror; no current manufacturer-controlled AFM acquired. |
| E | [EASA A.583 TCDS](https://www.easa.europa.eu/en/downloads/7062/en) via [type page](https://www.easa.europa.eu/en/document-library/type-certificates/aircraft-cs-25-cs-22-cs-23-cs-vla-cs-lsa/easaa583-tecnam-p2008) | Issue14, 31 March 2026; Section A, pp.3-7, especially A.IV.1 p.6 | Regulator origin; identifies AFM 2008/100, latest issue. Does not authenticate the mirror's revision as current. |
| F | [LBA FSM 3/75](https://ul-fluglehrer.de/resources/fsm_75_3_Startstrecke.pdf) | 1 July 1975, reprint1995; cover; A.3/A.4/A.5, B, C.4-C.6, D example1 (PDF3-6) | Original publication layout with LBA publisher attribution; third-party mirror. No current LBA-hosted original located in bounded searches. |
| C | [CAA Safety Sense09](https://www.caa.co.uk/media/wcebqozv/ssl09-caa-safety-sense-weight-balance-and-performance.pdf) via [CAA index](https://www.caa.co.uk/general-aviation/safety-topics/safety-sense-leaflets/) | August2024; pp.3,11-15, especially tables pp.13/15 | Regulator-hosted authoritative alternative, currently linked by CAA; not evidence of EASA-wide applicability. |

SHA-256 of acquired files:

```text
T e1b615c5a93df200c9ba3c3fa3e8dd3831fa5bffd7ef186fc842c0fab635ad7d
E ef45aec18d4a581afc3eba6266326951541701fbb0dbc5d63a469086643e2d6f
F 4ecd913dc11946573bb4407478931a3e6e19fc15332c418d72d0d1aa5b8abda1
C 41a5e23c35760439254c9c0ba1033f9ef8fbf578f13e80563432ea2fda478cc3
```

Rights status: T has no reuse grant established by this acquisition. E carries a proprietary/all-rights-reserved notice. F's cover permits reproduction with attribution; that notice is evidence in the mirrored document, not a general software/data licence or authentication of the mirror. C has no redistribution grant established here. Keep originals private; assess permission for any future bundled tables, images or substantial text separately. No public redistribution permission or legal clearance is claimed.

## Actual project applicability

Fresh AGENTS, ARCHITECTURE, ASSUMPTIONS, DISCLAIMER and `docs/requirements/{performance,detailed_aircraft_data}.md` were read at the pinned commit.

- `frontend/src/modules/mass-balance/data/aircraft-catalogue.ts` contains P2008 JC entries with **650kg** MTOM, plus PA-28-161, C172S and DR400/120; these M&B entries contain no performance grids or airframe-specific AFM/configuration proof.
- `frontend/src/modules/aircraft/data/aircraft-model-catalogue.json` is a model picker, including P2008 JC and DA40; an entry does not establish engine, propeller, supplements or source validity.
- `frontend/tests/fixtures/poh-aircraft.ts` explicitly defines fictional wiring data. It supplies no primary performance evidence.
- `frontend/src/core/adapters/aircraft.schema.ts` stores optional performance grids with `sourceUnits`/`sourceReference`, surface name plus takeoff/landing factors, and verification revision. These fields do not establish baseline runway condition, additive wind correction, correction target, range, supplement applicability or serial-number match. Wind limits are not wind-distance corrections.
- `docs/architecture/performance-safety-factor-pipeline.md` accepts one friction, slope and wind multiplier shared by both operations, applies surface/slope only to roll, and wind to full distances. Existing arithmetic tests cannot establish source applicability.

The Tecnam document matches an actual project model. That is a **candidate**, not proof for any stored registration. The 650kg catalogue makes the supplement distinction particularly material: do not use the basic 630kg chapter merely because the model name matches.

## Aircraft-specific candidate: Tecnam

T applies to CS-VLA P2008 JC; basic engine Rotax912S2, GT-2/173/VRR-FW101 SRTC fixed-pitch propeller. S4 replaces Section5 for the 650kg modification; other propeller supplements also exist. E distinguishes P2008JC from NG and confirms basic630kg/optional650kg variants. Applicability remains conditional on airframe configuration and current AFM/supplement verification. [T, E]

T S4 5W-7/5W-15: grass baseline; 650kg; tabulated pressure altitude0-10000ft, temperature−25/0/25/50°C. Basic limitations2-9 also specify ambient−25°C through+50°C and altitude13000ft MSL; the latter is not permission to extend these performance tables. Takeoff: T/O flaps, full throttle, lift-off48KIAS, obstacle60KIAS. Landing: LAND flaps, idle, final54KIAS. [T]

| Correction | Takeoff | Landing | Source target |
| :-- | :-- | :-- | :-- |
| Headwind | −5m/kt | −4m/kt | Wind box does not explicitly distinguish roll/full target. |
| Tailwind | +15m/kt | +13m/kt | Additive metres, not a constant multiplier. |
| Paved versus grass | −10% | −10% | Ground roll explicitly. |
| +1% runway slope | +7% | −3% | Ground roll explicitly. |
| In-service variation factor | 1.10 | 1.67 | Distances; separate from environmental corrections. |

No general wind/slope maximum is established by those boxes; no wet-grass definition or correction is supplied there. Do not extrapolate them to arbitrary winds/slopes. Paved correction is not permission to add a generic grass uplift to this already-grass baseline. [T]

## Fallback candidates and limits

F is historical German advisory material, not aircraft-specific data. It prioritises handbook instructions and describes its factors as averages. Table C starts with POH distance over **15m**, corrected sequentially. C.4: ±10% per1% slope on the running full-distance sum; C.5a/b: dry firm short grass +20%, then moist soil +10%. A.4 defines short grass≤3cm, longer grass bounded by half the front-wheel height and≤8cm. A.5 intentionally supplies no takeoff headwind reduction; it provides no tailwind table. No general landing surface/slope algorithm is established by C. Do not extend this takeoff table to LR/LD. [F]

C is UK GA guidance; p.3 describes UK Part-NCO/ANO context. Its p.13 table gives takeoff/landing-distance indicators (not explicitly roll-only): tailwind10% of lift-off speed ×1.2 for either operation; uphill2% takeoff ×1.1, downhill2% landing ×1.1. Factors multiply. P.15 gives dry grass≤20cm ×1.2/1.15 (TO/LD), wet grass≤20cm ×1.3/1.35, wet paved landing ×1.15, soft ground/snow ×1.25/1.25; AFM surface instructions take precedence. General factors1.33/1.43 follow other corrections. Missing table cells are not automatic unit factors; no headwind benefit is established here. This is an alternative for acceptance, not an approved global replacement for FSM. [C]

## Independently calculated reference cases

These are transcription/arithmetic checks against the inspected originals, computed with Python Decimal independently of AeroDash. They do **not** validate a flight or combined operational pipeline. Script and exact output are retained as `reference-checks.py` and `reference-results.json` in job613.

| Case | Sourced inputs | Independent calculation | Interpretation |
| :-- | :-- | :-- | :-- |
| T1 | S4 5W-7,650kg,SL,25°C: TOR264m,TOD436m | paved TOR `264×0.90=237.60m` | Isolated explicit roll correction. |
| T2 | Same | +1% uphill TOR `264×1.07=282.48m` | Isolated explicit slope correction. |
| T3 | S4 5W-15,650kg,SL,25°C: LR179m,LD388m | paved LR `179×0.90=161.10m`; +1% uphill LR `179×0.97=173.63m` | Separate alternatives, not stacked. |
| T4 | Same uncorrected TOD/LD | `436×1.10=479.60m`; `388×1.67=647.96m` | Separate in-service factor arithmetic only. |
| T5 | T wind coefficients; selected3kt tailwind | TO delta `3×15=45m`; landing delta `3×13=39m` | Delta only; target/order/range unresolved, no operational output. |
| F1 | D example1:316m, stated10% height uplift,50% snow uplift | `316×1.10=347.6`; round as publication to348; `348×1.50=522m` | Reproduces publication; not an endorsement of its height rounding. Without intermediate rounding:521.4m. |
| F2 | C.5a then C.5b | `1.20×1.10=1.32` | 32% cumulative, not30%; no invented base distance. |
| C1 | P.13 tailwind row plus adverse2% slope row | `1.20×1.10=1.32` | Dimensionless arithmetic at documented increments, not arbitrary interpolation. |
| C2 | P.15 wet grass then general factor | TO `1.30×1.33=1.729`; landing `1.35×1.43=1.9305` | Arithmetic only; not transferred onto Tecnam grass data. |

The publication's 15m obstacle and the application's 50ft (15.24m) metric must remain distinct. No conversion of obstacle-height performance is validated here.

## Unsupported matrix at handoff

“Acquired” means source inspected; every operational row remains subject to acceptance below.

| Profile/operation | Wind | Surface | Slope | Operational status and concrete blocker |
| :-- | :-- | :-- | :-- | :-- |
| P2008JC basic630kg | T coefficients acquired | T grass baseline/paved correction | T roll rule | Candidate only; project entries650kg; no configuration/current-revision match. |
| P2008JC S4 650kg | T additive coefficients acquired; target/order/range unresolved | T roll correction; wet/soft condition missing | T signed roll coefficients; range unresolved | Candidate only; serial/modification/propeller/supplement verification absent. |
| PA-28-161, C172S, DR400/120 | No applicable original acquired | No applicable original acquired | No applicable original acquired | Unsupported; no aircraft-specific correction/base-table acceptance. |
| DA40 and remaining picker types | No accepted source | No accepted source | No accepted source | Unsupported; model name alone insufficient. |
| Generic FSM takeoff | No tailwind support; no headwind reduction | F takeoff candidates only | F full-distance candidate | Blocked by authenticity/currency acceptance and full-distance contract conflict. |
| Generic FSM landing | No accepted wind fallback | Not established by C | Not established by C | Unsupported; do not reuse takeoff constants. |
| Generic UK CAA alternative | Relative-speed tailwind indicator; no headwind benefit | C candidates for TO/LD | C adverse2% increments | UK-guidance scope, target/range/baseline and product contract require acceptance. |
| Any profile without POH base tables | Irrelevant | Irrelevant | Irrelevant | Block raw/operational output; fallback supplies no base distances. |

## Recommendations, owners and bounded next actions

PLAN614 owns the source-acceptance decision and every outcome of this research, then #305 implementation/review/CI before #300 composition. Research is complete as a useful partial acquisition; no operational factor is accepted by this dossier.

1. **Accept or reject one precise source/configuration first.** PLAN614's #305 delivery owner should spend at most one further acquisition session (45min) locating a manufacturer-controlled current Tecnam2008/100 plus S4/S3/S9 applicability and serial/modification evidence. Use the manufacturer site/contact route identified in T0-9. No email was sent by this job. If controlled data cannot be obtained, retain the explicit blocker and use private user-supplied AFM review; do not label the mirror current. Obtain any necessary reuse permission before bundling content.
2. **Resolve the mathematical contract before coding selection.** FSM's full-distance rule conflicts with REQ-PF-004's roll-only rule; CAA's distance-labelled tables also supply no basis for assuming a roll-only target. Tecnam uses additive operation-specific wind corrections, signed slope rules and grass baselines; the shared factors cannot faithfully encode all of them. Record a source-specific target/order/range decision, or keep that combination unsupported. This is product/domain work for the existing delivery owner, not a new certification claim.
3. **Bound fallback acceptance.** For F, seek an official LBA/DAeC archive copy or publisher confirmation of this edition and current status in that session; for C, decide explicitly whether UK guidance is an allowed alternative in the chosen user scope. Do not silently mix their different limits or label CAA guidance an EASA regulatory minimum. Existing1.25 takeoff preset is not supported by C's1.33 recommendation. Estimation ratios and extrapolation remain outside this acquisition.
4. **Use isolated source cases as acceptance inputs.** Add independent domain cases only after resolving applicability; include incorrect base surface, wrong supplement, unsupported wet condition, additive-versus-multiplicative wind, roll/full target and changed-profile invalidation. Then require the normal functional gates, independent fresh-session review and Playwright UI path for #305/#300. This research makes no frontend change.

No additional local-model delegation: `hq local-work` reported queued606/GPU busy; existing owners610/609 retain replenishment. This finite source acquisition did not bypass resource/pending limits.

## Search failures and remaining uncertainty

- The official Diamond legacy AFM URL `https://support.diamond-air.at/fileadmin/uploads/files/after_sales_support/DA40-180/Airplane_Flight_Manual/Basic_Manual/60101e-r10-complete.pdf` failed TLS verification; HTTP timed out, alternate support host did not resolve. TLS verification was not bypassed; no DA40 constants were accepted from search snippets.
- FSM direct retrieval initially returned403 with Python; normal TLS-verified curl with a browser user agent retrieved the PDF. LBA-domain searches for FSM3/75 and the title found no official copy; absence from search is not proof of withdrawal.
- T's 2020 mirror may be superseded. E requires the latest AFM; its document-number match does not prove airframe applicability, mirror authenticity or currency. The bundle contains multiple supplements: choosing the first matching performance page would be unsafe.
- C's current index links the 2024 document; this does not establish global regulatory applicability, a universal condition envelope or permission to redistribute it.
- Reference arithmetic checks numerical interpretation only. Operational wind targets, combined correction order, range limits, baseline conditions and four-distance propagation require explicit source acceptance. No manufacturer's response, payment, rights grant, aviation-data certification or flight validation was obtained or presumed.

## Verification of this research change

`pnpm lint && pnpm test:unit` passed in the existing web-dev toolbox:93 test files,1846 unit tests. Frozen dependency installation succeeded without lockfile changes. Decimal results were checked against the dossier, and the cited numeric table pages were rendered and visually inspected. No product code/schema, test expectations or data files changed. E2E was not run for this Markdown-only research change; the implementation owner must execute the browser paths when #305/#300 change the frontend. No PR, source acceptance, CI acceptance or merge is claimed by this research branch.

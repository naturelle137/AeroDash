@phase-A @fleet @wizard @electric
Feature: Battery-electric aircraft wizard (Pipistrel Velis Electro)
  As a pilot / flight-school instructor
  I want to add a Pipistrel Velis Electro to the fleet without seeing fuel fields
  So that the aircraft is represented on its own terms (battery pack, reserve floor)
  And so that the combustion UX for the rest of my fleet is unchanged

  # @E2E-A-007@ (FROM: @UJ-A-004@)
  @UJ-A-004 @phase-A @e2e @smoke @E2E-A-007
  Scenario: Pilot creates a Pipistrel Velis Electro, the wizard flips to electric and fuel UI is hidden
    Given the pilot navigates to the Fleet page
    When the pilot clicks "Add New Aircraft"
    Then the wizard opens at Step 1 — Identity
    And the Powertrain selector shows "Combustion" as active

    When the pilot picks manufacturer "Pipistrel" and model "Velis Electro"
    And the pilot fills in registration "OK-VVV" and ICAO "PIVE"
    Then the Powertrain selector shows "Electric" as active

    When the pilot clicks "Continue"
    Then the wizard is on Step 2 — Certification and Envelope

    When the pilot sets MTOM to "600"
    And the pilot confirms there are already 4 envelope points
    And the pilot clicks "Continue"
    Then the wizard is on Step 3 — Weighing Reports

    When the pilot sets BEM to "428" and Empty CG to "1.920"
    And the pilot clicks "Continue"
    Then the wizard is on Step 4 — Load Stations
    And the "+ Add Fuel Tank" button is not visible
    And the fuel-tank toggle is not visible
    And an informational note mentions "battery-electric"

    When the pilot clicks "Continue"
    Then the wizard is on Step 5 — Wind Limits

    When the pilot clicks "Continue"
    Then the wizard is on Step 6 — Battery Pack

    When the pilot enters usable energy "24.8", reserve floor "5.0", nominal voltage "345" and chemistry "LiFePO4"
    And the pilot clicks "Continue"
    Then the wizard is on Step 7 — Review and Save
    And the review shows powertrain "Electric"
    And the review shows battery pack usable energy "24.8"

    When the pilot clicks "Save as Draft"
    Then the saved-draft chooser offers "Start flight prep", "Verify now" and "Back to Fleet"

    When the pilot chooses "Back to Fleet" in the saved-draft chooser
    Then the pilot is back on the Fleet page
    And the aircraft "OK-VVV" is listed with a "Draft" status badge

  # @E2E-A-008@ (FROM: @UJ-A-004@)
  @UJ-A-004 @phase-A @e2e @E2E-A-008
  Scenario: Combustion wizard is unchanged — fuel tank button remains visible for a Tecnam P2008 JC
    Given the pilot navigates to the Fleet page
    When the pilot clicks "Add New Aircraft"
    Then the wizard opens at Step 1 — Identity
    And the Powertrain selector shows "Combustion" as active

    When the pilot fills in the Identity step with registration "D-EBPN", manufacturer "Tecnam", model "P2008 JC", ICAO "P208"
    Then the Powertrain selector shows "Combustion" as active

    When the pilot clicks "Continue"
    And the pilot sets MTOM to "630"
    And the pilot clicks "Continue"
    And the pilot sets BEM to "433" and Empty CG to "1.882"
    And the pilot clicks "Continue"
    Then the wizard is on Step 4 — Load Stations
    And the "+ Add Fuel Tank" button is visible

  @UJ-A-004 @phase-A @e2e
  Scenario Outline: Mobile wizard keeps the active step visible during navigation
    Given the pilot uses a 390 by 900 viewport
    And the pilot navigates to the Fleet page
    When the pilot clicks "Add New Aircraft"
    And the pilot fills in the Identity step with registration "D-TEST", manufacturer "<manufacturer>", model "<model>", ICAO "<icao>"
    And the pilot clicks "Continue"
    And the pilot sets MTOM to "<mtom>"
    And the pilot clicks "Continue"
    And the pilot sets BEM to "<bem>" and Empty CG to "<cg>"
    And the pilot clicks "Continue"
    And the pilot clicks "Continue"
    And the pilot clicks "Continue"
    And the pilot completes the battery step when electric
    Then the wizard indicator shows "Review" as active among <count> steps without clipping
    When the pilot goes back one wizard step
    Then the wizard indicator shows "<previous>" as active among <count> steps without clipping
    And the future "Review" step is disabled
    When the pilot selects the completed "Identity" step
    Then the wizard indicator shows "Identity" as active among <count> steps without clipping
    And the future "Review" step is disabled

    Examples:
      | manufacturer | model         | icao | mtom | bem | cg    | count | previous     |
      | Tecnam       | P2008 JC      | P208 | 630  | 433 | 1.882 | 6     | Wind Limits  |
      | Pipistrel    | Velis Electro | PIVE | 600  | 428 | 1.920 | 7     | Battery Pack |

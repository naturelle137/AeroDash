@phase-A @fleet @wizard
Feature: Aircraft creation wizard
  As a pilot
  I want to create a new aircraft profile via a guided six-step wizard
  So that my Mass & Balance calculations use correct limits from my POH/AFM

  # @E2E-A-002@ (FROM: @UJ-A-001@)
  @UJ-A-001 @phase-A @e2e @smoke @E2E-A-002
  Scenario: Pilot completes all six wizard steps and sees the new aircraft on the Fleet page with a Draft badge
    Given the pilot navigates to the Fleet page
    When the pilot clicks "Add New Aircraft"
    Then the wizard opens at Step 1 — Identity

    When the pilot fills in the Identity step with registration "D-EBPN", manufacturer "Tecnam", model "P2008 JC", ICAO "P208"
    Then the "Continue" button is enabled

    When the pilot clicks "Continue"
    Then the wizard is on Step 2 — Certification and Envelope

    When the pilot sets MTOM to "630"
    And the pilot confirms there are already 4 envelope points
    Then the "Continue" button is enabled

    When the pilot clicks "Continue"
    Then the wizard is on Step 3 — Weighing Reports

    When the pilot sets BEM to "433" and Empty CG to "1.882"
    Then the "Continue" button is enabled

    When the pilot clicks "Continue"
    Then the wizard is on Step 4 — Load Stations

    When the pilot adds a seat station named "Pilot & Passenger" with arm "1.145"
    And the pilot adds a fuel tank station named "Fuel Tank"
    Then the "Continue" button is enabled

    When the pilot clicks "Continue"
    Then the wizard is on Step 5 — Wind Limits
    And the "Continue" button is enabled

    When the pilot clicks "Continue"
    Then the wizard is on Step 6 — Review and Save

    When the pilot clicks "Save as Draft"
    Then the saved-draft chooser offers "Start flight prep", "Verify now" and "Back to Fleet"

    When the pilot chooses "Back to Fleet" in the saved-draft chooser
    Then the pilot is back on the Fleet page
    And the aircraft "D-EBPN" is listed with a "Draft" status badge

  # @E2E-A-003@ (FROM: @UJ-A-001@)
  @UJ-A-001 @phase-A @e2e @E2E-A-003
  Scenario: Envelope editor never drops below 4 points — removal is blocked at the minimum
    Given the pilot navigates to the Fleet page
    When the pilot clicks "Add New Aircraft"
    And the pilot fills in the Identity step with registration "D-EBPN", manufacturer "Tecnam", model "P2008 JC", ICAO "P208"
    And the pilot clicks "Continue"
    Then the wizard is on Step 2 — Certification and Envelope

    When the pilot sets MTOM to "630"
    And the pilot adds a fifth envelope point
    And the pilot removes one envelope point
    Then 4 envelope points remain and none of them can be removed
    And no envelope error message is visible
    And the "Continue" button is enabled

  # @E2E-A-004@ (FROM: @UJ-A-001@)
  @UJ-A-001 @phase-A @e2e @E2E-A-004
  Scenario: Owner ID field is not present anywhere in the wizard — system generates it automatically (REQ-AD-019)
    Given the pilot navigates to the Fleet page
    When the pilot clicks "Add New Aircraft"
    Then the wizard opens at Step 1 — Identity
    And no field labelled "Owner ID" or "ownerId" is visible on the page

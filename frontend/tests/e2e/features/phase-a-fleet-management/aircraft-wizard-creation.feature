# @E2E-AC-001@ (FROM: @UJ-A-001@)
@phase-A @fleet @wizard
Feature: Aircraft creation wizard
  As a pilot
  I want to create a new aircraft profile via a guided 5-step wizard
  So that my Mass & Balance calculations use correct limits from my POH/AFM

  # @E2E-AC-001@ (FROM: @UJ-A-001@)
  @smoke @E2E-AC-001
  Scenario: Pilot completes all 5 wizard steps and sees the new aircraft on the Fleet page with a Draft badge
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
    Then the wizard is on Step 5 — Review and Save

    When the pilot clicks "Save as Draft"
    Then the pilot is back on the Fleet page
    And the aircraft "D-EBPN" is listed with a "Draft" status badge

  # @E2E-AC-002@ (FROM: @UJ-A-001@)
  @E2E-AC-002
  Scenario: Pilot cannot advance past Step 2 with fewer than 4 envelope points — Continue is disabled and an error is visible
    Given the pilot navigates to the Fleet page
    When the pilot clicks "Add New Aircraft"
    And the pilot fills in the Identity step with registration "D-EBPN", manufacturer "Tecnam", model "P2008 JC", ICAO "P208"
    And the pilot clicks "Continue"
    Then the wizard is on Step 2 — Certification and Envelope

    When the pilot sets MTOM to "630"
    And the pilot removes an envelope point so that only 3 remain
    Then the "Continue" button is disabled
    And an envelope error message is visible

    When the pilot adds a fourth envelope point
    Then the "Continue" button is enabled

  # @E2E-AC-003@ (FROM: @UJ-A-001@)
  @E2E-AC-003
  Scenario: Owner ID field is not present anywhere in the wizard — system generates it automatically (REQ-AD-019)
    Given the pilot navigates to the Fleet page
    When the pilot clicks "Add New Aircraft"
    Then the wizard opens at Step 1 — Identity
    And no field labelled "Owner ID" or "ownerId" is visible on the page

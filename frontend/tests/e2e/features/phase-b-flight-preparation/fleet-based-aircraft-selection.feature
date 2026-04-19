# @E2E-MB-001@ (FROM: @UJ-F-002@)
@wip @phase-B @fleet @flight-prep
Feature: Fleet-based aircraft selection on the Flight Prep page
  As a pilot
  I want the Flight Prep page to read aircraft from my personal fleet
  So that only my own aircraft are available for Mass & Balance planning

  # @E2E-MB-001@ (FROM: @UJ-F-002@)
  @E2E-MB-001
  Scenario: Empty fleet shows "No aircraft" CTA that navigates to the wizard
    Given the pilot opens the Flight Prep page on a fresh browser session
    Then the "No aircraft in your fleet yet" message is visible
    And an "Add Aircraft" button is visible

    When the pilot clicks the "Add Aircraft" button on the Flight Prep page
    Then the pilot is taken to the aircraft creation wizard

  # @E2E-MB-002@ (FROM: @UJ-F-002@)
  @smoke @E2E-MB-002
  Scenario: Aircraft added via wizard appears in the Flight Prep dropdown with a [Draft] label
    Given the pilot has added an aircraft with registration "D-EBPN" via the wizard
    When the pilot navigates to the Flight Prep page
    Then the aircraft dropdown is visible
    And the dropdown contains an option matching "D-EBPN" with "[Draft]" in its label

    When the pilot selects the "D-EBPN" aircraft from the dropdown
    Then the M&B section becomes unlocked

  # @E2E-MB-003@ (FROM: @UJ-F-002@)
  @E2E-MB-003
  Scenario: Hardcoded catalogue aircraft are not in the dropdown when the fleet is empty — regression against AIRCRAFT_CATALOGUE leak
    Given the pilot opens the Flight Prep page on a fresh browser session
    Then the "No aircraft in your fleet yet" message is visible
    And no option with text "D-ELUX" is present in the aircraft dropdown
    And no option with text "Tecnam P2008" is present in the aircraft dropdown

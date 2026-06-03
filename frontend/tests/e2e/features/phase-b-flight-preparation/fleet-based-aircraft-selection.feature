@phase-B @fleet @flight-prep
Feature: Fleet-based aircraft selection on the Flight Prep page
  As a pilot
  I want the Flight Prep page to read aircraft from my personal fleet
  So that only my own aircraft are available for Mass & Balance planning

  # @E2E-B-008@ (FROM: @UJ-B-005@)
  @UJ-B-005 @phase-B @e2e @E2E-B-008
  Scenario: Empty fleet shows "No aircraft" CTA that navigates to the wizard
    Given the pilot opens the Flight Prep page on a fresh browser session
    Then the "No aircraft in your fleet yet" message is visible
    And an "Add Aircraft" button is visible

    When the pilot clicks the "Add Aircraft" button on the Flight Prep page
    Then the pilot is taken to the aircraft creation wizard

  # @E2E-B-009@ (FROM: @UJ-B-005@)
  # @wip: superseded by the H-011 draft-acknowledgement gate — selecting a Draft
  # now routes through the inline ack (M&B stays locked until acknowledged), so
  # "the M&B section becomes unlocked" on a bare select no longer holds. The
  # correct behaviour is covered by E2E-B-011 below (which passes). Out of scope
  # for #294; remove or rewrite B-009 to reflect the ack gate.
  @wip @UJ-B-005 @phase-B @e2e @E2E-B-009
  Scenario: Aircraft added via wizard appears in the Flight Prep dropdown with a [Draft] label
    Given the pilot has added an aircraft with registration "D-EBPN" via the wizard
    When the pilot navigates to the Flight Prep page
    Then the aircraft dropdown is visible
    And the dropdown contains an option matching "D-EBPN" with "[Draft]" in its label

    When the pilot selects the "D-EBPN" aircraft from the dropdown
    Then the M&B section becomes unlocked

  # @E2E-B-011@ (FROM: @UJ-B-005@)
  @UJ-B-005 @phase-B @e2e @E2E-B-011
  Scenario: Selecting a draft aircraft requires acknowledging the unverified-data warning
    Given the pilot has added an aircraft with registration "D-EBPN" via the wizard
    When the pilot navigates to the Flight Prep page
    And the pilot selects the "D-EBPN" aircraft from the dropdown
    Then an inline draft acknowledgement warning is shown
    And the Mass & Balance section remains locked

    When the pilot acknowledges the draft warning to continue
    Then the M&B section becomes unlocked

  # @E2E-B-010@ (FROM: @UJ-B-005@)
  @UJ-B-005 @phase-B @e2e @E2E-B-010
  Scenario: Hardcoded catalogue aircraft are not in the dropdown when the fleet is empty — regression against AIRCRAFT_CATALOGUE leak
    Given the pilot opens the Flight Prep page on a fresh browser session
    Then the "No aircraft in your fleet yet" message is visible
    And no option with text "D-ELUX" is present in the aircraft dropdown
    And no option with text "Tecnam P2008" is present in the aircraft dropdown

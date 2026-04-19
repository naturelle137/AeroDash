# @E2E-AC-004@ (FROM: @UJ-A-001@)
@wip @phase-A @fleet @wizard @decimal
Feature: Decimal input precision in the aircraft wizard
  As a pilot
  I want decimal values I type to be stored exactly as entered
  So that safety-critical Mass & Balance data is not silently truncated

  Background:
    Given the pilot navigates to the Fleet page
    And the pilot clicks "Add New Aircraft"
    And the pilot fills in the Identity step with registration "D-EBPN", manufacturer "Tecnam", model "P2008 JC", ICAO "P208"
    And the pilot clicks "Continue"
    And the pilot sets MTOM to "630"
    And the pilot clicks "Continue"

  # @E2E-AC-004@ (FROM: @UJ-A-001@)
  @E2E-AC-004
  Scenario: High-precision decimal values survive the Weighing Reports step intact
    When the pilot types "433.75" into the BEM field and tabs away
    Then the BEM field retains the value "433.75"

    When the pilot types "1.105" into the Empty CG field and tabs away
    Then the Empty CG field retains the value "1.105"

    When the pilot clicks "Continue"
    And the pilot adds a seat station named "Pilot" with arm "1.877"
    Then the arm field for station "Pilot" retains the value "1.877"

  # @E2E-AC-005@ (FROM: @UJ-A-001@)
  @E2E-AC-005
  Scenario: European comma decimal separator is accepted and treated identically to a period
    When the pilot types "433,75" into the BEM field and tabs away
    Then the BEM field retains the value "433.75"

    When the pilot types "1,105" into the Empty CG field and tabs away
    Then the Empty CG field retains the value "1.105"

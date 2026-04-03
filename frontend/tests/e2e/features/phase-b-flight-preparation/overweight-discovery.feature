@wip
Feature: Discover structural mass limit violations
  As a pilot
  I want to be warned about all structural mass limits
  So that I respect both MTOM and MZFM constraints

  Background:
    Given the pilot starts a new flight preparation

  # @E2E-B-004@ (FROM: @UJ-B-003@)
  @UJ-B-003 @phase-B @e2e @mass-limits @module-mb
  Scenario: Full passenger and baggage load exceeds maximum takeoff mass
    When the pilot selects aircraft "D-ECSM"
    And loads four heavy adults and maximum baggage
    Then a critical notification "MTOM Exceeded" is displayed

  # @E2E-B-005@ (FROM: @UJ-B-003@)
  @UJ-B-003 @phase-B @e2e @mass-limits @module-mb
  Scenario: Reducing baggage clears MTOM but zero-fuel mass still exceeds MZFM
    When the pilot selects aircraft "D-ECSM"
    And loads four heavy adults with reduced baggage
    Then the total mass is within MTOM
    And a critical notification "MZFM Exceeded" is displayed

Feature: Complete a textbook flight preparation within all limits
  As a pilot
  I want to prepare a flight without limit violations or inconsistencies
  So that I can depart with confidence

  Background:
    Given the fleet holds the synthetic Mass & Balance test aircraft
    And the pilot starts a new flight preparation

  # @E2E-B-001@ (FROM: @UJ-B-005@)
  @UJ-B-005 @e2e @flight-prep @happy-path @module-mb
  Scenario: Pilot completes a clean flight preparation
    When the pilot selects aircraft "D-EBPN"
    And loads two passengers and light baggage
    And adds sufficient fuel for the trip
    Then the aircraft masses are within limits
    And the center of gravity remains within the envelope during the flight
    And the only warning is the unverified draft-profile notice

  @e2e @flight-prep @optional-occupancy
# @E2E-B-012@ (FROM: @UJ-B-005@)
  Scenario Outline: Solo loading retains required crew checks
    When the viewport for occupancy is <width> pixels wide
    And the pilot selects aircraft "D-ECSM"
    And occupant presets exclude baggage and update the front mass
    And the pilot loads the solo configuration
    Then only the draft notice remains for solo loading
    When the pilot empties the required front aggregate
    Then the empty required aggregate warns without naming the optional rear seats
    When the pilot restores solo mass and clears the optional rear input
    Then a missing optional input blocks calculation until explicit zero

    Examples:
      | width |
      | 1280  |
      | 390   |

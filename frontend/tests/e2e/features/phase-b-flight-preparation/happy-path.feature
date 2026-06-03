Feature: Complete a textbook flight preparation without warnings
  As a pilot
  I want to prepare a flight without warnings or inconsistencies
  So that I can depart with confidence

  Background:
    Given the pilot starts a new flight preparation

  # @E2E-B-001@ (FROM: @UJ-B-005@)
  @UJ-B-005 @e2e @flight-prep @happy-path @module-mb
  Scenario: Pilot completes a clean flight preparation
    When the pilot selects aircraft "D-EBPN"
    And loads two passengers and light baggage
    And adds sufficient fuel for the trip
    Then the aircraft masses are within limits
    And the center of gravity remains within the envelope during the flight
    And no warnings are displayed
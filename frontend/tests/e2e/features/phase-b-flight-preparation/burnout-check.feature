Feature: Detect CG migration during fuel burn-off
  As a pilot
  I want to discover unsafe CG migration before flight
  So that I can redistribute the load and avoid instability during landing

  Background:
    Given the pilot starts a new flight preparation

  # @E2E-B-002@ (FROM: @UJ-B-001@)
  @UJ-B-001 @phase-B @e2e @cg-migration @module-mb
  Scenario: Fuel burn-off reveals aft CG migration beyond envelope limit
    When the pilot selects aircraft "D-EAMB"
    And loads heavy rear passengers and aft baggage
    And adds a full fuel load
    Then a critical notification "CG Migration Limit Exceeded" is displayed

  # @E2E-B-003@ (FROM: @UJ-B-001@)
  @UJ-B-001 @phase-B @e2e @cg-migration @module-mb
  Scenario: Redistributing baggage forward resolves CG migration violation
    When the pilot selects aircraft "D-EAMB"
    And loads heavy rear passengers and aft baggage
    And adds a full fuel load
    And the pilot redistributes baggage weight forward
    Then the center of gravity remains within the envelope during the flight
    And no critical notifications are displayed

@wip
Feature: Reveal CG migration risk across burn sequences
  As a pilot
  I want to see CG behavior under all fuel burn sequences
  So that I can identify dangers hidden by a single-line trend

  Background:
    Given the pilot starts a new flight preparation

  # @E2E-B-006@ (FROM: @UJ-B-004@)
  @UJ-B-004 @phase-B @e2e @burn-polygon @module-mb
  Scenario: Alternative burn sequence pushes CG beyond aft envelope limit
    When the pilot selects aircraft "D-EMTK"
    And loads a pilot with a rear passenger and aft baggage
    And fills both fuel tanks to capacity
    Then a critical notification "CG Migration Limit Exceeded" is displayed

  # @E2E-B-007@ (FROM: @UJ-B-004@)
  @UJ-B-004 @phase-B @e2e @burn-polygon @module-mb
  Scenario: Redistributing load resolves burn-sequence CG migration violation
    When the pilot selects aircraft "D-EMTK"
    And loads a pilot with a rear passenger and aft baggage
    And fills both fuel tanks to capacity
    And the pilot moves the passenger forward and reduces aft baggage
    Then the center of gravity remains within the envelope during the flight
    And no critical notifications are displayed

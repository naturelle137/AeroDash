Feature: Try an alternative load without changing the saved plan
  As an instructor
  I want to demonstrate an alternative load on a scratch copy
  So that the student's saved plan stays unchanged

  Background:
    Given the fleet holds the synthetic Mass & Balance test aircraft
    And the pilot starts a new flight preparation

  @phase-B @e2e @demo @module-mb
  Scenario: A demo load shows the overload and discarding it restores the saved plan
    When the pilot selects aircraft "D-ECSM"
    And loads four heavy adults with reduced baggage
    And the instructor starts a demo
    And loads four heavy adults and maximum baggage
    Then a critical notification "MTOM Exceeded" is displayed
    When the instructor discards the demo
    Then the demo banner is not displayed
    And the total mass is within MTOM

  @phase-B @e2e @demo @module-mb
  Scenario: A demo load is never written to the saved plan
    When the pilot selects aircraft "D-ECSM"
    And loads four heavy adults with reduced baggage
    And the instructor starts a demo
    And loads four heavy adults and maximum baggage
    Then the saved plan still holds the reduced baggage

  @phase-B @e2e @demo @module-mb
  Scenario: Discarding a demo restores the entered Performance temperature
    When the pilot selects aircraft "D-ECSM"
    And the pilot sets temperature "10" °C in Flight Prep
    And the instructor starts a demo
    And the pilot sets temperature "35" °C in Flight Prep
    And the instructor discards the demo
    Then the Flight Prep temperature is "10" °C

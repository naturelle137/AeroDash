Feature: Mass & Balance entries per aircraft survive an aircraft switch
  As a pilot
  I want my entries restored when I return to an aircraft
  So that switching aircraft does not lose my work, and clearing really clears it

  Background:
    Given the fleet holds the synthetic Mass & Balance test aircraft
    And the pilot starts a new flight preparation

  @phase-B @e2e @module-mb
  Scenario: Entries return after switching away and back
    When the pilot selects aircraft "D-ECSM"
    And loads four heavy adults with reduced baggage
    And the pilot selects aircraft "D-EMTK"
    And the pilot selects aircraft "D-ECSM"
    Then the restored draft notice is displayed

  @phase-B @e2e @module-mb
  Scenario: Cleared entries do not return after switching away and back
    When the pilot selects aircraft "D-ECSM"
    And loads four heavy adults with reduced baggage
    And the pilot selects aircraft "D-EMTK"
    And the pilot selects aircraft "D-ECSM"
    And the pilot clears the restored draft
    And the pilot selects aircraft "D-EMTK"
    And the pilot selects aircraft "D-ECSM"
    Then the restored draft notice is not displayed

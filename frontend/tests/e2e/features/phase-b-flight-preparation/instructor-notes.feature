Feature: Instructor notes on results
  As an instructor
  I want to leave a teaching note on a result
  So that the student sees why the number matters without any warning being hidden

  Background:
    Given the fleet holds the synthetic Mass & Balance test aircraft
    And the pilot starts a new flight preparation

  @phase-B @e2e @module-mb
  Scenario: A note is attributed and survives a reload
    When the pilot selects aircraft "D-ECSM"
    And the instructor "CRI Meyer" adds the note "Watch the aft CG migration" on the takeoff result
    Then the note "Watch the aft CG migration" is shown as an instructor note by "CRI Meyer"
    When the pilot reloads the page
    And the pilot selects aircraft "D-ECSM"
    Then the note "Watch the aft CG migration" is shown as an instructor note by "CRI Meyer"

  @phase-B @e2e @module-mb
  Scenario: A note does not hide a critical notification
    When the pilot selects aircraft "D-ECSM"
    And loads four heavy adults and maximum baggage
    And the instructor "CRI Meyer" adds the note "Overload is acceptable" on the takeoff result
    Then a critical notification "MTOM Exceeded" is displayed

  @phase-B @e2e @module-mb
  Scenario Outline: Warning notes retain the critical warning
    Given the raw POH workflow viewport is <width> by <height>
    When the pilot selects aircraft "D-ECSM"
    And loads four heavy adults and maximum baggage
    And the instructor adds a note on the MTOM warning
    Then a critical notification "MTOM Exceeded" is displayed
    And the warning note evidence is captured as "<width>"
    When the pilot reloads the page
    And the pilot selects aircraft "D-ECSM"
    Then the warning note remains available

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

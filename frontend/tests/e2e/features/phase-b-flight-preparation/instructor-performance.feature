@performance
Feature: Instructor notes on performance distances
  Synthetic aircraft data checks software wiring only.

  Scenario Outline: Distance notes remain distinct from warnings
    Given the raw POH workflow viewport is <width> by <height>
    And the verified synthetic Test POH aircraft is open in Performance
    When the pilot enters mass "1050" kg
    And the instructor adds performance notes
    Then performance notes and the extrapolation warning remain visible
    And performance note evidence is captured as "<width>"
    When the pilot reloads the page
    And the pilot reselects the performance aircraft
    Then performance notes remain available

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

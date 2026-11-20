@performance
Feature: Bounded extrapolation with acknowledgment
  Synthetic Test aircraft proves browser wiring, never aviation correctness.

  Scenario Outline: Every extrapolation outcome is shown honestly
    Given the raw POH workflow viewport is <width> by <height>
    And the verified synthetic Test POH aircraft is open in Performance
    When the pilot enters mass "900" kg
    Then four raw Test distances are computed inside the envelope
    When the pilot enters mass "1050" kg
    Then the extrapolated distances are withheld until acknowledged
    When the pilot acknowledges the extrapolated data
    Then the extrapolated estimate "384.0 m" is shown with its penalty note
    And the extrapolation evidence is captured as "acknowledged-<width>"
    When the pilot changes the temperature to "11" °C
    Then the extrapolated distances are withheld until acknowledged
    And the extrapolation evidence is captured as "revoked-<width>"
    When the pilot enters mass "1100" kg
    Then the extrapolated estimate is shown only after a fresh acknowledgment
    When the pilot enters mass "1101" kg
    Then the distances are blocked beyond the extrapolation limit
    And the extrapolation evidence is captured as "blocked-<width>"
    When the pilot enters mass "700" kg
    Then the distance "121.0 m" is shown at the documented minimum without an acknowledgment
    And the extrapolation evidence is captured as "benefit-capped-<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

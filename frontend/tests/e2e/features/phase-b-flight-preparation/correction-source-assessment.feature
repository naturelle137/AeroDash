@performance
Feature: Correction source assessment
  Synthetic Test aircraft and runway values prove browser wiring only. The type designator and
  mass match an inspected manual only to show that such a match is never accepted as applicability.

  Scenario Outline: The pilot sees which source each correction needs and why none applies
    Given the raw POH workflow viewport is <width> by <height>
    When I import a synthetic Test POH exchange file declaring type "P208", maximum mass 650 kg and stored surface factors
    And I explicitly verify the Test POH profile in Fleet
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    Then the takeoff roll is "220.0 m" using pressure altitude "1000 ft, entered directly"
    When the pilot saves runway "TEST" "27" with TORA "600" "m", LDA "550" "m", elevation "300" "ft" and surface "Grass / unpaved" "Dry (short grass ≤3 cm)"
    And the pilot assesses correction sources
    Then no correction source is available and the stored surface factors are not used
    And the "Runway surface" source names the candidate "Supplement S4 (650 kg)" with the reason "already for grass"
    And the "Runway surface" source rejects the candidate "Section 5 (basic 630 kg)" because "Written for 630 kg"
    And the "Wind" source rejects the candidate "Supplement S4 (650 kg)" because "adds metres per knot"
    And the raw takeoff roll still reads "220.0 m"
    And the correction source evidence is captured as "assessed-<width>"
    When the pilot changes the LDA to "500" "m"
    Then the correction source assessment has been cleared
    When the pilot saves the runway inputs
    And the pilot assesses correction sources
    And the pilot clears the runway inputs
    Then the correction source assessment has been cleared
    When the pilot assesses correction sources
    Then the "Runway surface" source names the candidate "Supplement S4 (650 kg)" with the reason "surface condition is unknown"
    When the pilot sets mass "950" kg and temperature "10" °C for the Test profile
    Then the correction source assessment has been cleared
    When the pilot assesses correction sources
    And the pilot reloads the app
    Then the correction source assessment has been cleared
    When the pilot selects the Test profile and assesses correction sources
    And the pilot deletes all local data from Privacy
    And the pilot returns to Performance without reloading
    Then the correction source assessment has been cleared
    And no aircraft profile can be assessed

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

@performance @offline
Feature: Explicit pressure-altitude method
  Synthetic Test aircraft and runway values prove browser wiring and arithmetic, never aircraft or airport data.

  Scenario Outline: Derive pressure altitude from QNH and field elevation while offline
    Given the raw POH workflow viewport is <width> by <height>
    When I import the synthetic Test POH exchange file
    And I explicitly verify the Test POH profile in Fleet
    And the pilot opens Performance and then loses connectivity
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    Then raw distances are refused until a pressure-altitude method is chosen
    When the pilot enters pressure altitude "1000" ft directly
    Then the takeoff roll is "220.0 m" using pressure altitude "1000 ft, entered directly"
    When the pilot derives pressure altitude from QNH "1000" "hPa" and field elevation "457.2" "m"
    Then no raw distances are shown
    And the derived pressure altitude is "1855 ft" from field elevation "457.2 m (1500.0 ft)" entered by the pilot
    And the takeoff roll is "228.5 m" using pressure altitude "1855 ft, derived from QNH and field elevation"
    When the pilot changes the QNH to "1001"
    Then no raw distances are shown
    When the pilot switches back to direct pressure-altitude entry
    Then the direct pressure altitude still reads "1000"
    And no raw distances are shown
    And the pressure-altitude evidence is captured as "derived-<width>"
    When the pilot reloads the app
    Then no pressure-altitude method or derived value remains

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Invalid QNH or field elevation never yields a pressure altitude
    Given the manual runway viewport is 390 by 844
    And the pilot opens Performance
    When the pilot derives pressure altitude from QNH "<qnh>" "<qnhUnit>" and field elevation "<elevation>" "<elevationUnit>"
    Then no derived pressure altitude is shown and the pilot is told "<message>"

    Examples:
      | qnh     | qnhUnit | elevation | elevationUnit | message                                        |
      |         | hPa     | 100       | ft            | Enter QNH as a finite decimal number.          |
      | NaN     | hPa     | 100       | ft            | Enter QNH as a finite decimal number.          |
      | 1013    |         | 100       | ft            | Select the QNH unit (hPa).                     |
      | 849     | hPa     | 100       | ft            | outside the supported 850–1100 hPa model range |
      | 1100.5  | hPa     | 100       | ft            | outside the supported 850–1100 hPa model range |
      | 1013    | hPa     | Infinity  | m             | Enter field elevation as a finite decimal number. |
      | 1013    | hPa     | 100       |               | Select the field elevation unit (ft or m).     |
      | 1013    | hPa     | -458      | m             | outside the supported -1500 to 15000 ft        |

  Scenario: QNH outside the standard band warns without blocking
    Given the manual runway viewport is 1440 by 1000
    And the pilot opens Performance
    When the pilot derives pressure altitude from QNH "940" "hPa" and field elevation "-30.48" "m"
    Then the pilot is warned "WARN-UI-001"
    And the derived pressure altitude is "1952 ft" from field elevation "-30.48 m (-100.0 ft)" entered by the pilot

  Scenario Outline: A saved runway elevation is used only on request and never outlives its runway
    Given the manual runway viewport is <width> by <height>
    And the pilot opens Performance
    When the pilot saves runway "TEST" "09" with TORA "1000" "m", LDA "900" "m", elevation "-12" "ft" and surface "Paved" "Dry"
    And the pilot derives pressure altitude from QNH "1013.25" "hPa" and field elevation "" ""
    Then no derived pressure altitude is shown
    When the pilot copies the saved runway elevation
    Then the derived pressure altitude is "-20 ft" from field elevation "-12 ft (-12.0 ft)" copied from runway "TEST 09"
    When the pilot changes the LDA to "1800" "ft"
    Then the copied field elevation has been removed
    When the pilot saves the runway inputs
    And the pilot copies the saved runway elevation
    And the pilot deletes all local data from Privacy
    And the pilot returns to Performance without reloading
    Then no pressure-altitude method or derived value remains
    And no saved runway is shown

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

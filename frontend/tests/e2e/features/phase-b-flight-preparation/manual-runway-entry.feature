@performance @offline
Feature: Offline manual runway entry
  Synthetic runway values prove browser wiring and storage, never airport data or a runway assessment.

  Scenario Outline: Enter, edit and reload a manual runway while offline
    Given the manual runway viewport is <width> by <height>
    And the pilot opens Performance and then loses connectivity
    When the pilot saves runway "TEST" "09" with TORA "2000" "ft", LDA "550" "m", elevation "-12" "ft" and surface "Paved" "Wet"
    Then the saved runway shows TORA "2000 ft (609.6 m)", LDA "550 m (550.0 m)" and elevation "-12 ft (-3.7 m)"
    And the runway is labelled user-entered and the runway assessment is unavailable
    When the pilot changes the LDA to "1800" "ft"
    Then the saved runway is no longer shown as current
    When the pilot saves the runway inputs
    And the pilot reloads the app
    Then the runway form still holds LDA "1800" in "ft" and TORA "2000" in "ft"
    And the saved runway shows TORA "2000 ft (609.6 m)", LDA "1800 ft (548.6 m)" and elevation "-12 ft (-3.7 m)"
    And the field elevation is not used as pressure altitude
    And the manual runway evidence is captured as "offline-<width>"
    When the pilot clears the runway inputs
    And the pilot reloads the app
    Then no saved runway is shown

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Metre and foot declarations are retained independently
    Given the manual runway viewport is <width> by 1000
    And the pilot opens Performance
    When the pilot saves runway "TEST" "<rwy>" with TORA "<tora>" "<toraUnit>", LDA "<lda>" "<ldaUnit>", elevation "<elev>" "<elevUnit>" and surface "Grass / unpaved" "Damaged turf"
    And the pilot reloads the app
    Then the saved runway shows TORA "<toraShown>", LDA "<ldaShown>" and elevation "<elevShown>"

    Examples:
      | width | rwy | tora  | toraUnit | lda  | ldaUnit | elev   | elevUnit | toraShown              | ldaShown              | elevShown              |
      | 1440  | 18  | 3280  | ft       | 1000 | m       | -100   | ft       | 3280 ft (999.7 m)      | 1000 m (1000.0 m)     | -100 ft (-30.5 m)      |
      | 390   | 36  | 304.8 | m        | 1000 | ft      | -30.48 | m        | 304.8 m (304.8 m)      | 1000 ft (304.8 m)     | -30.48 m (-100.0 ft)   |

  Scenario: A runway without surface condition is not saved
    Given the manual runway viewport is 390 by 844
    And the pilot opens Performance
    When the pilot enters runway "TEST" "27" with TORA "800" "m", LDA "700" "m", elevation "0" "m" and surface type "Paved" only
    And the pilot saves the runway inputs
    Then saving is refused because "Select the surface condition."
    And no saved runway is shown

  Scenario Outline: Unusable available distances are not saved
    Given the manual runway viewport is 1440 by 1000
    And the pilot opens Performance
    When the pilot enters runway "TEST" "27" with TORA "<tora>" "m", LDA "<lda>" "<ldaUnit>", elevation "100" "m" and surface "Paved" "Dry"
    And the pilot saves the runway inputs
    Then saving is refused because "<message>"
    And no saved runway is shown

    Examples:
      | tora     | lda | ldaUnit | message                                   |
      |          | 700 | m       | Enter TORA as a finite decimal number.    |
      | 0        | 700 | m       | TORA must be greater than zero.           |
      | -800     | 700 | m       | TORA must be greater than zero.           |
      | Infinity | 700 | m       | Enter TORA as a finite decimal number.    |
      | 800      | NaN | m       | Enter LDA as a finite decimal number.     |
      | 800      | 700 |         | Select the LDA unit (m or ft).            |

  Scenario Outline: Damaged or newer saved runway data is never used
    Given the manual runway viewport is 390 by 844
    And the browser holds <stored> manual runway data
    When the pilot opens Performance
    Then the pilot is told "<message>"
    And no saved runway is shown
    When the pilot clears the runway inputs
    And the pilot reloads the app
    Then no storage problem is reported

    Examples:
      | stored  | message                                     |
      | damaged | damaged or invalid                          |
      | newer   | newer format version 2                      |

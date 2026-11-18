@performance
Feature: Corrected takeoff and landing distances
  Synthetic distances prove browser wiring only. The registration and mass match the one accepted
  manual excerpt so the correction rules are reachable; the table values are not POH data.

  Scenario Outline: The pilot sees corrected distances with their source, and none for other aircraft
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "<registration>" declaring type "P208" and maximum mass 650 kg
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot saves runway "TEST" "27" with TORA "600" "m", LDA "550" "m", elevation "300" "ft" and surface "Paved" "Dry"
    Then the corrected takeoff distances are <state>
    When the pilot enters takeoff headwind "-2" kt and slope "1" %
    Then the corrected takeoff distances are <outcome>
    And the corrected distance evidence is captured as "<registration>-<width>"

    Examples:
      | width | height | registration | state                                       | outcome                                  |
      | 1440  | 1000   | D-EBPN       | "unavailable: Enter the headwind component" | "final 267 m for the ground roll"        |
      | 390   | 844    | D-EBPN       | "unavailable: Enter the headwind component" | "final 267 m for the ground roll"        |
      | 1440  | 1000   | D-TEST       | "unavailable: No accepted correction source"| "unavailable: No accepted correction source" |

  Scenario Outline: The pilot sees whether the corrected distance fits the declared runway
    Given the raw POH workflow viewport is 1440 by 1000
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot saves runway "TEST" "27" with TORA "<tora>" "m", LDA "550" "m", elevation "300" "ft" and surface "Paved" "Dry"
    And the pilot enters takeoff headwind "0" kt and slope "0" %
    Then the takeoff runway comparison is "<verdict>"

    Examples:
      | tora | verdict             |
      | 2000 | Fits declared runway |
      | 100  | Insufficient runway  |

  Scenario Outline: The pilot is warned when the selected safety factor is below the recommended minimum
    Given the raw POH workflow viewport is 1440 by 1000
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot saves runway "TEST" "27" with TORA "2000" "m", LDA "550" "m", elevation "300" "ft" and surface "Paved" "Dry"
    And the pilot enters takeoff headwind "0" kt and slope "0" %
    And the pilot selects the takeoff safety factor "<preset>"
    Then the takeoff safety factor warning is "<warning>"

    Examples:
      | preset                                        | warning |
      | Manual (in-service factor)                    | shown   |
      | EASA standard (1.25 take-off, 1.43 landing)   | absent  |

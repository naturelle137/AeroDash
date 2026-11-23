@performance
Feature: Corrected takeoff and landing distances
  Synthetic distances prove browser wiring only. The registration and mass match the one accepted
  manual excerpt so the correction rules are reachable; the table values are not POH data.

  Scenario Outline: Flight Prep identifies the scope of raw distances
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot selects the imported aircraft "D-EBPN" in Flight Prep
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot sets temperature "10" °C in Flight Prep
    Then Flight Prep identifies the raw distance scope and captures evidence

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: The pilot sees corrected distances with their source, and none for other aircraft
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "<registration>" declaring type "<type>" and maximum mass <mass> kg
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot selects manual configuration "<configuration>"
    And the pilot saves runway "TEST" "27" with TORA "600" "m", LDA "550" "m", elevation "300" "ft" and surface "Paved" "Dry"
    Then the corrected takeoff distances are <state>
    When the pilot enters takeoff headwind "-2" kt and slope "1" %
    Then the corrected takeoff distances are <outcome>
    And the corrected distance evidence is captured as "<registration>-<width>"

    Examples:
      | width | height | registration | type | mass | configuration | state                                       | outcome                                  |
      | 1440  | 1000   | D-EBPN       | P208 | 650  | s9 | "unavailable: Enter the headwind component" | "final 267 m for the ground roll"        |
      | 390   | 844    | D-EBPN       | P208 | 650  | s9 | "unavailable: Enter the headwind component" | "final 267 m for the ground roll"        |
      | 1440  | 1000   | D-TEST       | P208 | 630  | basic | "unavailable: Enter the headwind component" | "final 267 m for the ground roll"        |
      | 390   | 844    | D-TEST       | P208 | 650  | s4 | "unavailable: Enter the headwind component" | "final 267 m for the ground roll"        |

  Scenario Outline: Aircraft without a manual rule set get a marked FSM 3/75 take-off estimate
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-TEST" declaring type "C172" and maximum mass 650 kg
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot saves runway "TEST" "27" with TORA "600" "m", LDA "550" "m", elevation "300" "ft" and surface "Grass" "Dry (short grass ≤3 cm)"
    And the pilot enters takeoff headwind "0" kt and slope "2" %
    Then the corrected takeoff distances are marked as an estimate from the LBA advisory
    And the corrected distance evidence is captured as "fsm-<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Unsupported corrections retain the selected safety factor
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-TEST" declaring type "C172" and maximum mass 650 kg
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot saves runway "TEST" "27" with TORA "600" "m", LDA "550" "m", elevation "300" "ft" and surface "Paved" "Dry"
    And the pilot enters takeoff headwind "-2" kt and slope "1" %
    And the pilot enters landing headwind "-2" kt and slope "-1" %
    Then the partial takeoff and unavailable landing disclose missing corrections
    And the corrected distance evidence is captured as "partial-fallback-<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Changing conditions updates the final distances
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot selects manual configuration "s9"
    And the pilot saves runway "TEST" "27" with TORA "2000" "m", LDA "2000" "m", elevation "300" "ft" and surface "Paved" "Dry"
    Then changing each phase's conditions updates its final distance
    And the corrected distance evidence is captured as "live-<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Landing corrections show their source independently of takeoff
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot selects manual configuration "s9"
    And the pilot saves runway "TEST" "27" with TORA "600" "m", LDA "900" "m", elevation "300" "ft" and surface "Paved" "Dry"
    And the pilot enters landing headwind "-2" kt and slope "-1" %
    Then the landing correction shows its source and final ground roll "694 m"
    And the landing correction evidence is captured as "<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: The pilot sees whether the corrected distance fits the declared runway
    Given the raw POH workflow viewport is 1440 by 1000
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot selects manual configuration "s9"
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
    And the pilot selects manual configuration "s9"
    And the pilot saves runway "TEST" "27" with TORA "2000" "m", LDA "550" "m", elevation "300" "ft" and surface "Paved" "Dry"
    And the pilot enters takeoff headwind "0" kt and slope "0" %
    And the pilot selects the takeoff safety factor "<preset>"
    Then the takeoff safety factor warning is "<warning>"

    Examples:
      | preset                                        | warning |
      | Manual (in-service factor)                    | shown   |
      | EASA standard (1.25 take-off, 1.43 landing)   | absent  |

  Scenario Outline: The briefing pack carries the low-safety-margin disclaimer from the combined flow
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot selects the imported aircraft "D-EBPN" in Flight Prep
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot sets temperature "10" °C in Flight Prep
    And the pilot selects manual configuration "s9"
    And the pilot saves runway "TEST" "27" with TORA "2000" "m", LDA "550" "m", elevation "300" "ft" and surface "Paved" "Dry"
    And the pilot enters takeoff headwind "0" kt and slope "0" %
    And the pilot selects the takeoff safety factor "Manual (in-service factor)"
    And the pilot opens the briefing pack
    Then the briefing pack states "safety factor"
    And the briefing pack states "Calculation based on low safety margin. Pilot in Command assumes full responsibility."
    And the briefing pack evidence is captured as "low-margin-<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Verified corrected distances appear in the briefing
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot selects the imported aircraft "D-EBPN" in Flight Prep
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot sets temperature "10" °C in Flight Prep
    And the pilot selects manual configuration "s9"
    And the pilot saves runway "TEST" "27" with TORA "2000" "m", LDA "550" "m", elevation "300" "ft" and surface "Paved" "Dry"
    And the pilot enters takeoff headwind "0" kt and slope "0" %
    And the pilot opens the briefing pack
    Then corrected briefing distances have no unverified marker
    And the briefing pack evidence is captured as "corrected-verified-<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Offline runway changes invalidate the current comparison
    Given the raw POH workflow viewport is <width> by <height>
    And the production app is cached for offline performance
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot selects manual configuration "s9"
    And the pilot goes offline
    And the pilot saves runway "TEST" "27" with TORA "2000" "m", LDA "550" "m", elevation "300" "ft" and surface "Paved" "Dry"
    And the pilot enters takeoff headwind "0" kt and slope "0" %
    Then the takeoff runway comparison is "Fits declared runway"
    And the takeoff safety factor warning is "shown"
    When the pilot saves runway "TEST" "27" with TORA "100" "m", LDA "550" "m", elevation "300" "ft" and surface "Paved" "Dry"
    Then the takeoff runway comparison is "Insufficient runway"
    And the corrected distance evidence is captured as "offline-<width>"
    When the pilot clears the runway surface condition
    Then the corrected takeoff distances are "unavailable: Save the manual runway"
    When the pilot enters takeoff headwind "" kt and slope "0" %
    Then the takeoff safety factor warning is "absent"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Pilot-entered wind multipliers work offline for both operations
    Given the raw POH workflow viewport is <width> by <height>
    And the production app is cached for offline performance
    When I import and verify a synthetic POH profile for registration "D-TEST" declaring type "C172" and maximum mass 650 kg
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot goes offline
    And the pilot saves runway "TEST" "27" with TORA "2000" "m", LDA "2000" "m", elevation "300" "ft" and surface "Paved" "Dry"
    And the pilot enters takeoff headwind "-2" kt and slope "1" %
    And the pilot enters landing headwind "-2" kt and slope "-1" %
    Then pilot-entered wind multipliers change both distances and clear with changed conditions
    And the corrected distance evidence is captured as "pilot-wind-<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Pilot-entered surface multipliers work offline for both operations
    Given the raw POH workflow viewport is <width> by <height>
    And the production app is cached for offline performance
    When I import and verify a synthetic POH profile for registration "D-TEST" declaring type "C172" and maximum mass 650 kg
    And the pilot opens Performance
    And the pilot sets mass "900" kg and temperature "10" °C for the Test profile
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot goes offline
    And the pilot saves runway "TEST" "27" with TORA "2000" "m", LDA "2000" "m", elevation "300" "ft" and surface "Paved" "Dry"
    And the pilot enters takeoff headwind "0" kt and slope "0" %
    And the pilot enters landing headwind "0" kt and slope "0" %
    Then pilot-entered surface multipliers work for both operations
    And the corrected distance evidence is captured as "pilot-surface-<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Pilot-entered surface source appears in the offline briefing
    Given the raw POH workflow viewport is <width> by <height>
    And the production app is cached for offline performance
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot selects the imported aircraft "D-EBPN" in Flight Prep
    And the pilot enters pressure altitude "1000" ft directly
    And the pilot sets temperature "10" °C in Flight Prep
    And the pilot selects manual configuration "s9"
    And the pilot goes offline
    And the pilot saves runway "TEST" "27" with TORA "2000" "m", LDA "2000" "m", elevation "300" "ft" and surface "Paved" "Dry"
    And the pilot enters takeoff headwind "0" kt and slope "0" %
    And the pilot enters landing headwind "0" kt and slope "0" %
    And the pilot enters surface multipliers for the briefing
    And the pilot opens the briefing pack
    Then the briefing discloses the pilot-entered surface source
    And the briefing pack evidence is captured as "pilot-surface-<width>"
    And the printed and PDF briefing disclose the pilot-entered surface source

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

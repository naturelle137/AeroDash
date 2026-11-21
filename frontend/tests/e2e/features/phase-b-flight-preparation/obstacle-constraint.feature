@performance @offline
Feature: Unverified obstacle constraint
  Synthetic entries prove browser wiring only; no obstacle clearance is ever claimed.

  Scenario Outline: Record and clear an obstacle while offline
    Given the manual runway viewport is <width> by <height>
    And the pilot opens Performance and then loses connectivity
    When the pilot enters an obstacle height "50" "ft" at distance "600" "m"
    Then the unverified obstacle warning is shown
    And the obstacle evidence is captured as "offline-<width>"
    When the pilot reloads the obstacle entry
    Then no unverified obstacle warning is shown
    When the pilot enters an obstacle height "50" "ft" at distance "600" "m"
    And the pilot clears the obstacle
    Then no unverified obstacle warning is shown

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Reject an invalid obstacle online
    Given the manual runway viewport is <width> by <height>
    And the pilot opens Performance
    When the pilot enters an obstacle height "-5" "ft" at distance "600" "m"
    Then the obstacle height error "Obstacle height must be greater than zero." is shown
    And no unverified obstacle warning is shown
    When the pilot enters an obstacle height "50" "ft" at distance "abc" "m"
    Then the obstacle distance error "Obstacle distance must be a number, for example 150." is shown
    And no unverified obstacle warning is shown

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: The briefing carries the obstacle gradient and unknown clearance
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot selects the imported aircraft "D-EBPN" in Flight Prep
    And the pilot enters an obstacle height "50" "ft" at distance "600" "m"
    Then the unverified obstacle warning is shown
    And the obstacle evidence is captured as "briefing-input-<width>"
    When the pilot changes and reloads the Flight Prep obstacle
    Then the unverified obstacle warning is shown
    When the pilot opens the briefing pack
    Then the briefing pack states "WARN-PF-001"
    And the briefing pack states "50 ft above the runway at 600 m from the runway"
    And the briefing pack states "Approximately 2.540%"
    And the briefing pack states "clearance cannot be determined"
    And the briefing pack evidence is captured as "obstacle-<width>"
    When the pilot closes the briefing and clears the obstacle
    And the pilot reloads the obstacle entry
    Then no unverified obstacle warning is shown

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

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

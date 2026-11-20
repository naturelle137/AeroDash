@performance @offline
Feature: Offline manual wind components
  Synthetic entries prove browser wiring only, never weather or a runway assessment.

  Scenario Outline: Compute wind components while offline
    Given the manual runway viewport is <width> by <height>
    And the pilot opens Performance and then loses connectivity
    When the pilot enters runway heading "270", wind from "330" and speed "20" "kt"
    Then the wind components show "Headwind" "10.0 kt" and crosswind "17.3 kt from the right"
    When the pilot enters runway heading "270", wind from "150" and speed "20" "kt"
    Then the wind components show "Tailwind" "10.0 kt" and crosswind "17.3 kt from the left"
    And the wind components are labelled as user-entered and advisory
    And the wind component evidence is captured as "offline-<width>"
    When the pilot enters runway heading "270", wind from "VRB" and speed "20" "kt"
    Then no wind components are shown

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Compute wind components online
    Given the manual runway viewport is <width> by <height>
    And the pilot opens Performance
    When the pilot enters runway heading "360", wind from "10" and speed "10" "kt"
    Then the wind components show "Headwind" "9.8 kt" and crosswind "1.7 kt from the right"
    And the wind component evidence is captured as "online-<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

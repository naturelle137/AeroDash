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

  Scenario Outline: Wind controls remain reachable in Flight Prep
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot selects the imported aircraft "D-EBPN" in Flight Prep
    And the pilot enters runway heading "270", wind from "330" and speed "20" "kt"
    Then the wind components show "Headwind" "10.0 kt" and crosswind "17.3 kt from the right"
    And the Flight Prep wind controls are reachable by keyboard at "<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Briefing includes current manual wind only
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot selects the imported aircraft "D-EBPN" in Flight Prep
    And the pilot enters runway heading "270", wind from "330" and speed "20" "kt"
    And the pilot opens the briefing pack
    Then the briefing pack states "Headwind: 10.0 kt; crosswind: 17.3 kt from the right"
    And the briefing pack states "No weather retrieved or performance correction applied"
    And the briefing pack evidence is captured as "wind-<width>"
    When the pilot returns from the briefing pack
    And the pilot enters runway heading "270", wind from "VRB" and speed "20" "kt"
    Then no wind components are shown
    When the pilot opens the briefing pack
    Then the briefing pack does not contain manual wind components

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

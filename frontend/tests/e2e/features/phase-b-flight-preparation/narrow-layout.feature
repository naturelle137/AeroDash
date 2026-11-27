@performance @offline @narrow-layout
Feature: Flight preparation fits a narrow viewport
  Synthetic aircraft and obstacle entries test layout only.

  Scenario Outline: Flight preparation and briefing remain reachable offline
    Given the raw POH workflow viewport is <width> by <height>
    And the production app is cached for offline performance
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot selects the imported aircraft "D-EBPN" in Flight Prep
    And the browser goes offline for forecast planning
    And the pilot reloads the obstacle entry
    And the pilot enters an obstacle height "50" "ft" at distance "600" "m"
    Then the unverified obstacle warning is shown
    And the narrow preparation layout is reachable
    When the pilot opens the briefing pack
    Then the briefing pack states "WARNING: Unverified obstacle data in use"
    And the narrow briefing layout is reachable

    Examples:
      | width | height |
      | 320   | 640    |
      | 390   | 844    |
      | 1440  | 1000   |

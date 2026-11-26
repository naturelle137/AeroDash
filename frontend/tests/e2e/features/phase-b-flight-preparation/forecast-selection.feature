@weather
Feature: Time-specific forecast selection
  Scenario Outline: Preserve manual wind and the selection when offline
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot selects the imported aircraft "D-EBPN" in Flight Prep
    And the pilot enters runway heading "270", wind from "330" and speed "20" "kt"
    And the pilot selects a forecast location and time
    Then the forecast is unavailable and manual wind remains unchanged
    When the pilot retrieves a synthetic DWD forecast
    Then the DWD forecast evidence is captured as "<width>"
    When the pilot retrieves a synthetic global forecast
    Then the global forecast evidence is captured as "<width>"
    When the pilot retrieves a synthetic hourly forecast
    Then the retrieved forecast evidence is captured as "<width>"
    When the browser goes offline for forecast planning
    Then the forecast selection and manual wind remain available offline
    When the pilot applies synthetic forecast values offline
    Then the forecast selection evidence is captured as "<width>"
    And a manual override clears forecast provenance

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Reject malformed and outdated forecasts without changing manual wind
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot selects the imported aircraft "D-EBPN" in Flight Prep
    And the pilot enters runway heading "270", wind from "330" and speed "20" "kt"
    And the pilot retrieves a malformed synthetic forecast
    Then the malformed forecast is rejected and manual wind remains unchanged
    When the pilot retrieves an outdated synthetic forecast
    Then the outdated forecast cannot replace manual wind
    And the outdated forecast evidence is captured as "<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

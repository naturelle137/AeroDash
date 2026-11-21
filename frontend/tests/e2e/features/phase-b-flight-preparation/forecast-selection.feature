@weather
Feature: Time-specific forecast selection without a configured source
  Scenario Outline: Preserve manual wind and the selection when offline
    Given the raw POH workflow viewport is <width> by <height>
    When I import and verify a synthetic POH profile for registration "D-EBPN" declaring type "P208" and maximum mass 650 kg
    And the pilot selects the imported aircraft "D-EBPN" in Flight Prep
    And the pilot enters runway heading "270", wind from "330" and speed "20" "kt"
    And the pilot selects a forecast location and time
    Then the forecast is unavailable and manual wind remains unchanged
    When the browser goes offline for forecast planning
    Then the forecast selection and manual wind remain available offline
    When the pilot applies synthetic forecast values offline
    Then the forecast selection evidence is captured as "<width>"
    And a manual override clears forecast provenance

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

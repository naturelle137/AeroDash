@weather @performance
Feature: Weather-first inputs
  Synthetic entries prove browser wiring only, never weather or operational validity.

  Scenario Outline: Reuse temperature, wind and QNH entered once in Weather
    Given the manual runway viewport is <width> by <height>
    And the fleet holds the synthetic Mass & Balance test aircraft
    And the pilot starts a new flight preparation
    When the pilot selects aircraft "D-EBPN"
    And the pilot enters temperature "15", wind from "330" at "20" kt and QNH "1013" in Weather
    And the pilot enters runway heading "270" in Performance
    Then Performance shows the Weather temperature, wind and QNH as coming from Weather
    And the weather-first evidence is captured as "online-<width>"
    When the pilot types temperature "30" in Performance
    Then Performance states that its temperature overrides Weather

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  @offline
  Scenario Outline: Enter weather manually without connectivity
    Given the manual runway viewport is <width> by <height>
    And the fleet holds the synthetic Mass & Balance test aircraft
    And the pilot starts a new flight preparation
    When the pilot selects aircraft "D-EBPN"
    And the browser goes offline for forecast planning
    And the pilot enters temperature "15", wind from "330" at "20" kt and QNH "1013" in Weather
    And the pilot enters runway heading "270" in Performance
    Then Performance shows the Weather temperature, wind and QNH as coming from Weather
    And the weather-first evidence is captured as "offline-<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

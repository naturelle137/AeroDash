Feature: Read-only METAR retrieval
  Scenario Outline: Show a synthetic observation in Flight Prep
    Given the manual runway viewport is <width> by <height>
    And the fleet holds the synthetic Mass & Balance test aircraft
    And the pilot starts a new flight preparation
    When the pilot selects aircraft "D-EBPN"
    And a synthetic METAR is retrieved
    Then the synthetic METAR is displayed at "<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Prefer the forecast wind and label observation fallbacks in Flight Prep
    Given the manual runway viewport is <width> by <height>
    And the fleet holds the synthetic Mass & Balance test aircraft
    And the pilot starts a new flight preparation
    When the pilot selects aircraft "D-EBPN"
    And a synthetic TAF and METAR are retrieved
    Then the forecast wind is applied and the observation values are labelled as METAR at "<width>"

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |


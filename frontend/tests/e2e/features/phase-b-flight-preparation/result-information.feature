Feature: Explain flight preparation results
  @e2e @module-mb @REQ-UI-012
  Scenario Outline: Result information is accessible on desktop and mobile
    Given the fleet holds the synthetic Mass & Balance test aircraft
    And the pilot starts a new flight preparation
    When the viewport for occupancy is <width> pixels wide
    And the pilot selects aircraft "D-EBPN"
    And loads two passengers and light baggage
    And adds sufficient fuel for the trip
    Then the result information is available at <width> pixels

    Examples:
      | width |
      | 1440  |
      | 390   |

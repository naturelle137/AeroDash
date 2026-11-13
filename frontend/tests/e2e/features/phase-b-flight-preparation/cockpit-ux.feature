@cockpit-ux
Feature: Clear flight preparation guidance
  Synthetic fixtures establish software behavior only, never operational aircraft validity.

  Scenario Outline: Registration entry uses consistent casing
    Given the cockpit viewport width is <width>
    When the pilot enters a lowercase registration
    Then the registration is uppercase before saving
    Examples:
      | width |
      | 390   |
      | 900   |
      | 1440  |

  Scenario: Incomplete aircraft identity explains blocked progression
    Given the cockpit viewport width is 390
    When the pilot enters a lowercase registration
    Then the wizard explains which identity fields prevent progression

  Scenario Outline: Tablet navigation respects an explicit expansion
    Given the cockpit viewport width is <width>
    When the pilot expands the tablet navigation
    Then navigation destinations are readable
    Examples:
      | width |
      | 768   |
      | 900   |
      | 1023  |
      | 1024  |

  Scenario Outline: Incomplete loading guidance leads to its input
    Given the cockpit viewport width is <width>
    And the fleet holds the synthetic Mass & Balance test aircraft
    And the pilot starts a new flight preparation
    When the pilot selects aircraft "D-EBPN"
    Then the native aircraft picker identifies the chosen draft
    When the pilot clears the required pilot loading
    And the pilot requests the first incomplete loading input
    Then the incomplete loading input receives focus
    Examples:
      | width |
      | 390   |
      | 900   |
      | 1440  |

  Scenario Outline: Within-limit loading avoids a blanket safety claim
    Given the cockpit viewport width is <width>
    When I import the synthetic Test POH exchange file
    And I explicitly verify the Test POH profile in Fleet
    And the pilot opens the synthetic profile in Mass and Balance
    Then the result describes entered limits without claiming flight safety
    Examples:
      | width |
      | 390   |
      | 900   |
      | 1440  |

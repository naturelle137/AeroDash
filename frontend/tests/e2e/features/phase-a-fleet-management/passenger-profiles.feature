Feature: Passenger standard-weight profiles
  Scenario Outline: Manage passenger profiles on desktop and mobile
    Given a single Draft profile "D-EBPN" already exists in the fleet
    And the pilot is on the Fleet page
    When the pilot manages passenger profiles at width <width>
    Then the saved passenger profiles survive reload at width <width>

    Examples:
      | width |
      | 1440  |
      | 390   |

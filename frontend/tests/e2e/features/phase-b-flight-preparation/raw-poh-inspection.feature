@performance
Feature: Raw POH table inspection
  Synthetic Test aircraft proves browser wiring, never aviation correctness.

  Scenario Outline: Import, review and inspect all four distances without developer tools
    Given the raw POH workflow viewport is <width> by <height>
    When I import the synthetic Test POH exchange file
    Then I can inspect every imported table while the profile remains Draft
    And raw POH computation is blocked for the Draft
    When I explicitly verify the Test POH profile in Fleet
    Then the Performance navigation opens a usable table lookup
    And four raw Test distances are computed inside the envelope
    And editing each input immediately clears the raw distances
    And blank, nonfinite, nonpositive and out-of-envelope lookup inputs stay blocked
    And the reviewed tables survive a browser reload and exchange download
    And the raw POH browser evidence is captured

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario Outline: Invalid table data never produces distances
    Given the raw POH workflow viewport is 390 by 844
    When I import a Test POH profile with "<problem>"
    Then the table problem "<message>" blocks raw distances after explicit verification

    Examples:
      | problem           | message                         |
      | missing phase     | exactly one table               |
      | duplicate phase   | exactly one table               |
      | zero distance     | every distance must be positive |
      | incomplete grid   | complete rectangular grid       |
      | duplicate point   | complete rectangular grid       |

  Scenario Outline: Invalid exchange data is rejected before persistence
    Given the raw POH workflow viewport is 1440 by 1000
    When I import invalid Test POH JSON with "<problem>"
    Then Fleet rejects the exchange and has no Test profile

    Examples:
      | problem           |
      | invalid schema    |
      | negative distance |
      | nonfinite point   |
      | unsupported phase |

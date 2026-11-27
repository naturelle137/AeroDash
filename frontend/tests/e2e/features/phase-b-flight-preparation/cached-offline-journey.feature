@offline @flight-prep
Feature: Cached offline Flight Prep journey
  Synthetic data verifies software wiring only, not operational performance.

  Scenario Outline: Reopen and prepare a flight without network access
    Given the Flight Prep viewport is <width> by <height> and a synthetic aircraft is cached
    When the pilot reopens Flight Prep offline
    Then online forecast data is unavailable
    When the pilot prepares mass, fuel and manual runway performance offline
    Then the briefing preview contains the offline preparation
    And offline journey evidence is captured at <width> pixels

    Examples:
      | width | height |
      | 390   | 844    |
      | 1440  | 1000   |

@about
Feature: About the running app
  Scenario: About is reachable online and offline at desktop and mobile widths
    Given the pilot opens AeroDash for the About check
    Then the About view is reachable at desktop and mobile widths

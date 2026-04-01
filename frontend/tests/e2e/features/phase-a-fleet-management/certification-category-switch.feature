@wip
Feature: Switch certification category and enforce utility constraints
  As a pilot
  I want category-specific limits and stations to update when I change certification category
  So that I do not plan an aerobatic flight with normal-category assumptions

  Background:
    Given the pilot starts a new flight preparation

  # @E2E-A-001@ (FROM: @UJ-A-003@)
  @UJ-A-003 @phase-A @e2e @category-switch @module-mb
  Scenario: Utility category applies tighter limits and removes rear-seat loading
    When the pilot selects aircraft "D-ECSM"
    And loads a pilot, a rear passenger, and training fuel
    And the pilot switches the certification category to "Utility"
    Then the takeoff mass limit reflects the selected category
    And the rear seat station is not available for loading
    And the total mass is within MTOM
    And no critical notifications are displayed

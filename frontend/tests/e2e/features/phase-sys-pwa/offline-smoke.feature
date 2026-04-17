# @E2E-SYS-001@ (FROM: @UJ-SYS-001@)
@smoke @offline @pwa @sys
Feature: Offline-first app shell and M&B navigation
  As a pilot with no network connectivity
  I want the AeroDash app shell and M&B page to remain accessible
  So that I can perform safety-critical calculations without an internet connection

  # @E2E-SYS-001@ (FROM: @UJ-SYS-001@)
  @E2E-SYS-001 @smoke @offline
  Scenario: App shell loads and M&B navigation works while offline
    Given the pilot loads the app while online
    When the pilot goes offline
    Then the app shell is still visible
    And the pilot can navigate to the Mass and Balance page
    And the Mass and Balance page content is displayed

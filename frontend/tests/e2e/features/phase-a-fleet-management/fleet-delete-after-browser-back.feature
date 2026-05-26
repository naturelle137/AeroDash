@wip @phase-A @fleet @regression @issue-232
Feature: Fleet Delete control survives a browser-back from the profile editor
  As a pilot
  I want the Delete control on the Fleet list to keep working after I return
  from the profile editor via the browser back button (or the iOS Safari
  swipe-back gesture)
  So that destructive fleet management never silently no-ops on me when I
  navigate the way mobile browsers expect.

  # @E2E-A-010@ (FROM: @UJ-A-001@)
  @UJ-A-001 @phase-A @e2e @E2E-A-010
  Scenario: Delete confirmation opens after returning from the editor via the browser back button
    Given a single Draft profile "D-EBPN" already exists in the fleet
    And the pilot is on the Fleet page
    When the pilot taps "Edit" on the "D-EBPN" row
    And the pilot returns to the Fleet page using the browser back button
    Then tapping "Delete" on the "D-EBPN" row opens the delete confirmation dialog naming "D-EBPN"

  # @E2E-A-011@ (FROM: @UJ-A-001@)
  @UJ-A-001 @phase-A @e2e @E2E-A-011
  Scenario: Delete confirmation opens after a bfcache restore (simulated iOS Safari path)
    Given a single Draft profile "D-EBPN" already exists in the fleet
    And the pilot is on the Fleet page
    When the device restores the Fleet page from the browser bfcache
    Then tapping "Delete" on the "D-EBPN" row opens the delete confirmation dialog naming "D-EBPN"

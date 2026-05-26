@phase-A @fleet @regression @issue-232
Feature: Fleet Delete control survives a browser-back from the profile editor
  As a pilot
  I want the Delete control on the Fleet list to keep working after I return
  from the profile editor via the browser back button (or the iOS Safari
  swipe-back gesture)
  So that destructive fleet management never silently no-ops on me when I
  navigate the way mobile browsers expect.

  # @E2E-A-010@ (FROM: @UJ-A-001@)
  #
  # Control-path check: same-document SPA history back in Chromium does NOT
  # trigger the bfcache restore that the iOS Safari bug depends on (the
  # browser keeps the document live, so `pageshow` either does not fire or
  # fires with `persisted=false`). Vue Router unmounts the editor and mounts
  # a fresh FleetView on its own here — this scenario guards against a
  # regression of that default remount-on-route-change, which the Delete
  # handler depends on for the non-bfcache code path.
  @UJ-A-001 @phase-A @e2e @E2E-A-010
  Scenario: Delete confirmation opens after a standard browser-back from the editor (Chromium SPA back, control path)
    Given a single Draft profile "D-EBPN" already exists in the fleet
    And the pilot is on the Fleet page
    When the pilot taps "Edit" on the "D-EBPN" row
    And the pilot returns to the Fleet page using the browser back button
    Then tapping "Delete" on the "D-EBPN" row opens the delete confirmation dialog naming "D-EBPN"

  # @E2E-A-011@ (FROM: @UJ-A-001@)
  #
  # Regression-path check: exercises the IMP-SYS-SHARED-007 code path that
  # the iOS Safari swipe-back gesture triggers on real devices (bfcache
  # restore of the cached Fleet page → stale Vue reactivity → silent
  # Delete no-op without the fix). Chromium does not naturally bfcache an
  # active SPA, so we dispatch a synthetic `pageshow{persisted=true}` to
  # exercise the same listener real iOS Safari would dispatch. Without
  # IMP-SYS-SHARED-007 the Delete button would no-op; with the fix the
  # active /fleet view remounts cleanly and the confirmation dialog opens.
  @UJ-A-001 @phase-A @e2e @E2E-A-011
  Scenario: Delete confirmation opens after a bfcache restore of the Fleet page (regression path)
    Given a single Draft profile "D-EBPN" already exists in the fleet
    And the pilot is on the Fleet page
    When the device restores the Fleet page from the browser bfcache
    Then tapping "Delete" on the "D-EBPN" row opens the delete confirmation dialog naming "D-EBPN"

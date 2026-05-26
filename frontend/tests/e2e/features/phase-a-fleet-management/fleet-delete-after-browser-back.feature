@phase-A @fleet @regression @issue-232
Feature: Fleet Delete control survives a bfcache restore of the Fleet page
  As a pilot
  I want the Delete control on the Fleet list to keep working after the
  browser restores the page from its back/forward cache (the path iOS
  Safari hits on swipe-back or app-switch)
  So that destructive fleet management never silently no-ops on me on a
  cockpit tablet.

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
  #
  # The non-bfcache "edit → browser back → delete" path on Chromium is
  # vue-router's default unmount-on-route-change and is already exercised
  # by every other phase-A scenario that navigates between fleet routes;
  # an explicit control-path scenario here would pass with or without this
  # patch (no `<KeepAlive>` in the tree) so it has been omitted.
  @UJ-A-001 @phase-A @e2e @E2E-A-011
  Scenario: Delete confirmation opens after a bfcache restore of the Fleet page
    Given a single Draft profile "D-EBPN" already exists in the fleet
    And the pilot is on the Fleet page
    When the device restores the Fleet page from the browser bfcache
    Then tapping "Delete" on the "D-EBPN" row opens the delete confirmation dialog naming "D-EBPN"

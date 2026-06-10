Feature: Manual airport entry for an unlisted airfield
  As a pilot flying into an unregistered grass strip
  I want to enter the runway by hand and confirm its surface condition
  So that performance is computed from data I have verified myself

  Background:
    Given the pilot opens the airport page

  # @E2E-C-001@ (FROM: @UJ-C-002@)
  @UJ-C-002 @phase-C @e2e @module-ap @E2E-C-001
  Scenario: An unknown ICAO offers manual airport entry
    When the pilot searches for the unlisted airport "ZZZZ"
    Then manual airport entry is offered for "ZZZZ"

  # @E2E-C-002@ (FROM: @UJ-C-002@)
  @UJ-C-002 @phase-C @e2e @module-ap @E2E-C-002
  Scenario: Performance is refused until the surface condition is chosen
    Given the pilot has entered a manual runway 600 m long
    When the pilot tries to compute performance without a surface condition
    Then performance computation is refused pending a surface condition

  # @E2E-C-003@ (FROM: @UJ-C-002@)
  @UJ-C-002 @phase-C @e2e @module-ap @E2E-C-003
  Scenario: Choosing the surface condition unlocks the computation
    Given the pilot has entered a manual runway 600 m long
    When the pilot selects the runway surface condition "Dry"
    Then performance computation is ready to proceed

  # @E2E-C-004@ (FROM: @UJ-C-002@)
  @UJ-C-002 @phase-C @e2e @module-ap @E2E-C-004
  Scenario: Manual runway overrides are saved
    Given the pilot has entered a manual runway 600 m long
    When the pilot saves the manual runway
    Then the runway data is confirmed saved

@phase-C @performance @performance-safety
Feature: Conservative extrapolation control on the Performance page
  As a pilot computing take-off and landing distances
  I want the system to flag, penalise, or refuse out-of-envelope conditions
  So that I never act on optimistic performance data beyond the POH charts

  Background:
    Given the pilot has a Verified aircraft "D-EPER" with published performance data
    And the pilot opens the Performance page
    And the pilot selects "D-EPER" for performance planning

  # @E2E-C-001@ (FROM: @UJ-C-001@)
  @UJ-C-001 @phase-C @e2e @E2E-C-001
  Scenario: Hot conditions inside the 10% band are penalised and require acknowledgment
    When the pilot enters conditions mass 800 kg, pressure altitude 5000 ft, temperature 54 °C
    And the pilot sets the available runway to 2000 m
    Then the result is flagged as extrapolated beyond the POH limits
    And the advisory is withheld until the extrapolation is acknowledged

    When the pilot acknowledges the extrapolated data as Pilot-in-Command
    Then a runway-sufficiency advisory is shown

  # @E2E-C-002@ (FROM: @UJ-C-001@)
  @UJ-C-001 @phase-C @e2e @E2E-C-002
  Scenario: Temperature beyond the extrapolation cap blocks the calculation
    When the pilot enters conditions mass 800 kg, pressure altitude 5000 ft, temperature 57 °C
    And the pilot sets the available runway to 2000 m
    Then the calculation is blocked because conditions exceed the extrapolation boundary

  # @E2E-C-003@ (FROM: @UJ-C-001@)
  @UJ-C-001 @phase-C @e2e @E2E-C-003
  Scenario: Pressure altitude beyond the extrapolation cap blocks the calculation
    When the pilot enters conditions mass 800 kg, pressure altitude 11100 ft, temperature 25 °C
    And the pilot sets the available runway to 2000 m
    Then the calculation is blocked because conditions exceed the extrapolation boundary

@performance @touch-flow
Feature: Reachable flight preparation controls
  Synthetic aircraft and runway values prove software usability only.
  Target dimensions do not establish glove, turbulence, accessibility or aviation certification.

  Scenario: Fleet import and review controls remain reachable
    When I import the synthetic Test POH exchange file
    Then the workflow targets are measured as "fleet-import"
    And I can inspect every imported table while the profile remains Draft
    And the workflow targets are measured as "fleet-review"
    When I open the synthetic profile verification dialog
    Then the workflow targets are measured as "fleet-verification"

  Scenario: Lookup choices support touch and keyboard
    When I import the synthetic Test POH exchange file
    And I explicitly verify the Test POH profile in Fleet
    Then the Performance navigation opens a usable table lookup
    And four raw Test distances are computed inside the envelope
    And the workflow targets are measured as "direct-lookup"
    When I switch pressure altitude methods using their labels and keyboard
    Then no raw distances are shown
    And the workflow targets are measured as "qnh-choices"

  Scenario: Saved runway and unsupported sources stay usable
    When I import the synthetic Test POH exchange file
    And I explicitly verify the Test POH profile in Fleet
    Then the Performance navigation opens a usable table lookup
    When the pilot saves runway "TEST" "09" with TORA "1000" "m", LDA "900" "m", elevation "457.2" "m" and surface "Paved" "Dry"
    And the pilot derives pressure altitude from QNH "1000" "hPa" and field elevation "" ""
    And the pilot copies the saved runway elevation
    Then the workflow targets are measured as "saved-runway"
    When the pilot assesses correction sources
    Then the unsupported source details remain reachable
    And the workflow targets are measured as "unsupported-sources"
    When the pilot changes the LDA to "1800" "ft"
    Then the saved runway is no longer shown as current
    And the copied field elevation has been removed
    And the correction source assessment has been cleared
    And the workflow targets are measured as "edited-runway"
    When the pilot saves the runway inputs
    And the pilot reloads the app
    Then the runway form still holds LDA "1800" in "ft" and TORA "1000" in "m"
    And the workflow targets are measured as "reloaded-runway"
    And runway actions accept touch or keyboard activation

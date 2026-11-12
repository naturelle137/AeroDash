@phase-A @verification-date
Feature: Verification dates cannot extend the trust window

  @e2e
  Scenario Outline: Draft verification rejects future dates and saves today
    Given a "draft" verification profile at viewport <width> by <height>
    When the pilot rejects a future sign-off then signs off today
    Then the verified profile loads without the expired acknowledgement

    Examples:
      | width | height |
      | 1280  | 900    |
      | 390   | 844    |

  @e2e
  Scenario Outline: Future persisted verification stays gated until valid re-verification
    Given a "future persisted" verification profile at viewport <width> by <height>
    When the pilot checks the future persisted verification gate
    And the pilot rejects a future sign-off then signs off today
    Then the verified profile loads without the expired acknowledgement

    Examples:
      | width | height |
      | 1280  | 900    |
      | 390   | 844    |

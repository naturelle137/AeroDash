@privacy @regression
Feature: Optional app lock hides the app without encrypting it
  The lock is an access gate for a shared unlocked browser, not encryption.

  Scenario Outline: A pilot enables the lock and a reload requires the passcode
    Given the pilot enables the app lock on Privacy at <width> by <height>
    When the pilot reloads AeroDash
    Then the lock screen hides the app and states that data is not encrypted
    When the pilot enters a wrong passcode
    Then the lock screen stays and reports a wrong passcode
    When the pilot enters the correct passcode
    Then the app is available again

    Examples:
      | width | height |
      | 1440  | 1000   |
      | 390   | 844    |

  Scenario: A forgotten passcode is recovered only by deleting local data
    Given the pilot enables the app lock on Privacy at 1440 by 1000
    When the pilot reloads AeroDash
    And the pilot deletes all local data from the lock screen
    Then the app is available again without a lock

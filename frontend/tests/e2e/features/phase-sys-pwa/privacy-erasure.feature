@privacy @regression
Feature: Erasure reports temporarily inaccessible storage
  Deterministic browser API failures verify reporting and retry, not physical device behavior.

  Scenario Outline: Denied storage retains data until access is restored and deletion retried
    Given Privacy holds saved data at <width> by <height>
    When the pilot deletes all data while the <store> getter is denied
    Then Privacy reports incomplete erasure and still clears reachable stores
    When storage access is restored and the pilot retries deletion
    Then Privacy reports successful erasure and the retained data is gone

    Examples:
      | store          | width | height |
      | localStorage   | 1440  | 1000   |
      | sessionStorage | 1440  | 1000   |
      | localStorage   | 390   | 844    |
      | sessionStorage | 390   | 844    |

# User journeys

Journeys describe intended pilot workflows and their observable outcomes. They help select browser acceptance tests; a written journey is not proof that the feature is implemented or tested. See the [roadmap](../development/roadmap.md) and [testing guide](../testing/TESTING.md).

- [Fleet management](01_fleet_management.md)
- [Flight preparation](02_flight_preparation.md)
- [Performance and safety](03_performance_safety.md)
- [System and usability](04_system_usability.md)
- [Weather and environment](05_weather_environment.md)
- [Fuel and endurance](06_fuel_endurance.md)
- [Onboarding and sync](07_onboarding_sync.md)

Extend a focused existing journey when possible. Include a happy path and relevant warning/recovery paths. Keep ordinary UJ/REQ references useful for discussion; no registry or mandatory tag chain. Preserve real Playwright scenario tags in tests.

Use labelled synthetic aircraft/conditions for software tests. Real-aircraft examples do not establish validated POH data. [Flight-training personas](discovery/230-training-personas.md) remain discovery recommendations.

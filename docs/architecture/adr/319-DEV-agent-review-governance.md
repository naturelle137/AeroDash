# 319: Independent review and protected integration

## Decision

Each change receives one independent review in a fresh session of any competent provider. Functional defects, red CI, security/safety issues, data loss and violations of the mandate or product vision block. Allow at most one fix round, then integrate on green required CI using normal product PR protections and signed commits. A new final-head review is not required.

HQ schedules work and owns integration. Do not enable competing GitHub workers or paid services. The CEO decides product-vision, money, irreversible destruction and legal/safety claims; agents own routine implementation and delivery.

## Consequences

Review effort stays bounded. P1 isolation, meaningful domain-reference tests, functional/security checks and truthful evidence remain necessary. This decision supersedes older repeat-review, trace-attestation and manual release-ceremony instructions.

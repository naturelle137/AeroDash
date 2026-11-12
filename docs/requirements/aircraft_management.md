# AeroDash Software Requirements - Aircraft Management (AC)

## Requirements

### REQ-AC-001: Profile CRUD Operations

The system shall allow the user to create an aircraft profile.

### REQ-AC-002: Registration Validation

When an aircraft profile is created or updated, the system shall reject a registration that is not 2–7 characters matching `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)?$` (case-insensitive).

### REQ-AC-003: Duplicate Registration Warning

If an aircraft registration already exists within the same owner's database, then the system shall emit a WARNING notification (`WARN-AC-001`) alerting the user about duplicate registration.

### REQ-AC-004: Profile Import

The system shall import aircraft profiles from external exchange files.

### REQ-AC-005: Profile Verification Status

The system shall represent aircraft profile verification status as `draft` or `verified`.

### REQ-AC-006: Passenger Profiles

The system shall allow creation of a passenger profile containing a name and standard weight.

### REQ-AC-007: Verification Provenance & Expiry

When the user verifies an aircraft profile, the system shall require sign-off provenance containing the verification date, verifier initials, POH revision and source weighing-report identity.

### REQ-AC-008: Read profile

The system shall allow the user to read an aircraft profile.

### REQ-AC-009: Update profile

The system shall allow the user to update an aircraft profile.

### REQ-AC-010: Delete profile

The system shall allow the user to delete an aircraft profile.

### REQ-AC-011: Draft working copies

When a profile is created or edited, the system shall mark the working copy `draft` until explicit verification.

### REQ-AC-012: Verified snapshot protection

While a profile snapshot is verified, the system shall prevent modification of that snapshot.

### REQ-AC-013: Draft calculation warning

When a calculation uses a draft profile, the system shall display a persistent WARNING (`WARN-AC-002`) identifying the profile as unverified.

### REQ-AC-014: Update passenger

The system shall allow updating a passenger profile.

### REQ-AC-015: Delete passenger

The system shall allow deletion of a passenger profile.

### REQ-AC-016: Record sign-off

When verification succeeds, the system shall persist the sign-off provenance with the verified profile.

### REQ-AC-017: Reject invalid sign-off dates

If either verification action receives a date that is not a real `YYYY-MM-DD` date on or before today in UTC, then the system shall reject the sign-off before persistence.

### REQ-AC-018: Verification age boundary

When a sign-off reaches 90 UTC calendar days of age, the system shall treat the profile as unverified for safety-critical use.

### REQ-AC-019: Changed weighing report

If the source weighing report differs from the recorded provenance, then the system shall treat the profile as unverified for safety-critical use.

### REQ-AC-020: Invalid stored sign-off

If stored provenance contains an invalid or future date, then the system shall treat the verification as expired.

### REQ-AC-021: Legacy verification

While a legacy verified profile has no provenance, the system shall retain its `verified-unattributed` classification.

## Design References

- **<a name="notificationScheme"></a>Notification Scheme:** [`docs/architecture/notification_schema.md`](../architecture/notification_schema.md)

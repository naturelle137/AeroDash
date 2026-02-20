### Summary
<!-- Briefly describe the code and documentation changes made in this PR. -->

### Related Issues
<!-- How Does this PR relate to tickets? Use the correct keyword for your target branch! -->
<!-- Target: develop  -> DO NOT CLOSE. Use "Related to #" or "Ref #" (e.g., Ref #123) -->
<!-- Target: main     -> CLOSE ISSUE.   Use "Closes #" or "Fixes #" (e.g., Closes #123) -->
- 

### Issue State Management (Post-Merge)
<!-- Please ensure these manual steps are taken once the PR is merged: -->
<!-- Delete the following lines if not applicable: -->
- [ ] If merging to `develop`: Changed Issue Label to `ready` & Project Status to `Ready for Release`
- [ ] If merging to `main`: Changed Issue Label to `fixed` & Project Status to `Done`

### Affected Items
<!-- What existing items are implemented or affected by these code changes? -->
<!-- Note: Journeys and Hazards are already traced to Requirements in the documentation. -->
- **Requirements Implemented/Affected:** `REQ-...` OR `N/A`

### Documentation Updates
<!-- Documentation is an integral part of this product. Please link the specific IDs created/modified (e.g., REQ-SYS-001, H-1A) -->
- [ ] **Requirements:** Created/Updated ID(s): ______ in `docs/requirements/` OR `N/A` (Reason: _________)
- [ ] **Architecture:** Created/Updated ID(s): ______ in `docs/architecture/` OR `N/A` (Reason: _________)
- [ ] **Risk Management:** Hazards updated/mitigated ID(s): ______ in `docs/risk_management/` OR `N/A` (Reason: _________)
- [ ] **Journeys:** Created/Updated ID(s): ______ in `docs/journeys/` OR `N/A` (Reason: _________)
- [ ] **Code Docs:** API docs/README/Changelog updated OR `N/A` (Reason: _________)

### Safety Considerations
- [ ] Checked Safety Traceability Matrix.
- [ ] No new hazards introduced.
- [ ] Existing mitigations preserved.
- [ ] P1 isolation maintained (no new P2/P3 imports in core modules).

### Quality & Testing Checklist
- [ ] **Target Branch:** This PR correctly targets `develop` (features/bugs) OR `main` (releases/hotfixes).
- [ ] **Unit Tests:** Added/updated and passing locally OR `N/A` (Reason: _________).
- [ ] **Integration Tests:** Passing OR `N/A` (Reason: _________).
- [ ] **Manual Testing:** Performed successfully (Mandatory for `main`) OR `N/A` (Reason: _________).
- [ ] **DoD:** All Definition of Done items from the linked Sub-Task/Feature/Bug are met.
- [ ] **Review:** I have performed a self-review of my own code and documentation.
- [ ] **ADR:** Does this change require an Architectural Decision Record (ADR) update/creation? If yes, it is included.

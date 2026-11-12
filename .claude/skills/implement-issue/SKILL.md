---
name: implement-issue
description: Implement an AeroDash GitHub issue through tested changes and an independently reviewed PR.
---

# Implement an issue

Follow [AGENTS.md](../../../AGENTS.md) and [CONTRIBUTING.md](../../../CONTRIBUTING.md).

1. Read the issue, current code, affected requirements and tests. Confirm what is already delivered; preserve concurrent branches and existing child tasks. New work uses independent Feature/Bug issues.
2. Work on an isolated branch from fresh develop. Classify P1/P2/P3. For P1, record formulas, units, failure boundaries and reference-test plan in the appropriate contract before changing behavior.
3. Implement the complete authorized scope. For a bug, reproduce it with a meaningful test, fix it and verify recovery. Preserve source/data limitations and avoid invented POH values.
4. Run lint/unit and applicable build, integration, P1 and browser checks from the testing guide. Report actual results and unfinished scope; do not tick unperformed acceptance checks.
5. Add a concise Unreleased changelog entry under Added/Changed/Fixed/Engineering per CONTRIBUTING §6. Use signed Conventional Commits; keep hooks enabled.
6. Open a focused PR using the template. Arrange one independent fresh-session review, one fix round at most and green required CI. Leave integration to the assigned owner when another job owns it. Close only delivered issue scope.

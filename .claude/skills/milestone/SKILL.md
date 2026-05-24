---
name: milestone
description: Use when the user asks to plan, align, break down, check, or create a milestone, roadmap, or release scope for AeroDash — including the slash forms (/milestone.plan, /milestone.align, /milestone.breakdown, /milestone.check, /milestone.create) or natural-language equivalents like "plan v0.7.0", "what's missing from milestone 12", "draft a milestone description for the next release", or "audit milestone vs repo state".
---

# Milestone workflows (AeroDash)

This skill bundles five milestone operations. Each has a dedicated sub-file; **load only the one matching the user's intent** to keep context lean.

## Routing

| User intent | Sub-file to load | Slash equivalent |
| :---------- | :--------------- | :--------------- |
| Strategic roadmap planning across versions | `plan.md` | `/milestone.plan <target> [--from <start>]` |
| Coverage validation: are Reqs+Journeys covered by/before target? | `align.md` | `/milestone.align <target_version>` |
| Decompose milestone into Product + Engineering GitHub issues | `breakdown.md` | `/milestone.breakdown <version>` |
| Pre-release: milestone vs repo state gap audit | `check.md` | `/milestone.check <milestone-number-or-version>` |
| Author GitHub-ready milestone description | `create.md` | `/milestone.create <version>` |

If user intent is ambiguous (e.g. "look at milestone 0.7.0"), ask which of the five they want before loading any sub-file.

## Shared vocabulary (used by all sub-files)

- **Requirement**: verifiable system obligation | constraint | acceptance condition
- **Journey**: end-to-end user | operational flow; real-use success path
- **Capability**: usable behavior for user | operator | dependent system
- **Milestone**: versioned | testable | vertical slice; real capability progression
- **Coverage**: explicit map `Requirement|Journey -> first satisfying Milestone`
- **Validation Evidence**: tests | analyses | simulations | reviews | demonstrations; correctness proof

## Shared rules

- safety-critical aviation context — be measurable and traceable, never vague
- forbid vague verbs without measurable object: `handle` | `support` | `improve`
- prefer verbs: `define` | `display` | `calculate` | `enforce` | `reject` | `trace` | `validate` | `detect` | `prove` | `assign`
- assume.target: forbidden for `alpha|beta|GA|production|release candidate` unless explicit workspace evidence
- discover.conflict: prefer explicit | versioned | traceable artifacts; no silent reconciliation of contradictory intent

## Shared output style

- bullet points | compressed wording | no full sentences | no repetition | no explanation | no justification | no extra text
- each sub-file declares its exact section structure — follow it precisely

## Procedure

1. Identify which sub-file applies from the user's intent.
2. `Read` that sub-file and follow its directives strictly.
3. If multiple operations are requested, run them sequentially and present each report under its own heading.

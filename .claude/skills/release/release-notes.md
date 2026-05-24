# Authoring the user-facing release description (AeroDash)

The GitHub Release body is **for pilots, not developers**. A pilot reading it should
learn what they can now *do* before a flight — not which classes were refactored.
This file is the craft guide; `SKILL.md` owns the publish workflow.

## Audience

The reader is the AeroDash persona from `README.md`: a GA pilot (EASA Part-NCO, SEP,
VFR + private IFR) preparing a real flight, often on a phone or iPad, possibly offline.
They are not contributors. They do not know what IndexedDB, Pinia, a "store", a "FSM",
or `REQ-AC-005` is. Write so a current AeroDash user understands what changed for them.

## Source of truth

Build the notes from these, in order:

1. **The dated `## [<version>]` section of `CHANGELOG.md`** — the authoritative change set.
   Never invent entries that aren't there.
2. **The GitHub milestone** for this version (`gh api repos/naturelle137/AeroDash/milestones?state=all`)
   — its title gives the release *theme / codename*; its description frames the goal.
3. **`docs/development/roadmap.md`** — for an accurate "What's Next" tied to the next milestone.

Translate, then group. A single `What's Included` bullet usually folds several
changelog lines into one pilot-facing capability.

## Structure (keep these exact headings)

```markdown
## AeroDash v<version> - <Theme from milestone title>

<1–2 plain-language sentences: what this milestone lets a pilot do that they couldn't before.>

### What's Included

- **<Capability in pilot terms>:** <what the pilot can now do and why it matters> (<optional REQ/ADR anchor>)
- ...

### What This Release Means

<One paragraph on where the product now stands for a real pilot — its trajectory, not a feature list.
Always reaffirm it is still alpha and not certified when true.>

### Known Scope Limits

- <What is deliberately not here yet, mapped to the version that will deliver it.>
- <Anything a pilot might wrongly assume works.>

### What's Next

<One paragraph: the next milestone's headline value, in pilot terms.>

[**Full Changelog**](https://github.com/naturelle137/AeroDash/blob/main/CHANGELOG.md)
```

## Voice rules

- **Lead with the benefit, then the mechanism.** "Your aircraft profiles now persist
  across sessions and devices" — not "Aircraft CRUD persisted in IndexedDB".
- **Bold lead-in = a theme**, grouping related changelog lines into one scannable bullet.
- **Surface Security/Engineering items only when a pilot would care** — as a trust or
  compatibility signal ("still runs on older iPads and Chromebooks"; "import is size-
  and type-checked before it's read"). Drop trace registries, ESLint rules, test counts,
  CI plumbing, refactors.
- **Be honest about limits.** This is safety-critical software. Never imply it is
  certified, and never let "What's Included" read as more complete than it is.
- **Promise no dates.** Future work is named by milestone/version, never by calendar.

## Do not

- Do not paste the changelog verbatim or narrate per commit/PR.
- Do not use scope codes (`REQ-`, `IMP-`, `H-`, `UJ-`) as the message — they are allowed
  only as a light trailing anchor in parentheses, never the subject of a sentence.
- Do not address developers ("we refactored", "the store now…", "added a Zod schema").
- Do not include commit hashes, PR numbers, file paths, or internal type/class names.
  A `code` token is fine only when it is user-meaningful (e.g. the `.aerodash.json`
  exchange file, a version string).
- Do not exceed what a pilot will read — tight bullets, scannable, no filler.

## Reusing an existing notes file

If `.github/release-notes/v<version>.md` already exists, **review and refine it against
the final CHANGELOG** rather than overwriting blindly — entries may have been added during
release stabilization. Confirm every bullet still maps to a real changelog line.

## Reference

The shipped `.github/release-notes/v0.2.0-alpha.md` and `v0.3.0-alpha.md` are the
canonical examples of tone, length, and structure. Match them.

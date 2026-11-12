# Author or review requirements

Read [the requirements format](../../docs/requirements/README.md) and [AGENTS.md](../../AGENTS.md). For authoring, inspect the intended behavior and related obligations before drafting. For review, compare the full original obligation with the proposed text, including future capabilities beyond current code.

For each active REQ heading check: a supported EARS pattern; one independently testable response; explicit trigger, units and acceptance boundaries; observable behavior rather than storage/framework/algorithm mechanisms; complete scope across current and future data classes. Split independent actions with unused stable IDs and update ordinary links. Put necessary design context in architecture. A user-facing exchange format may be an observable product contract; an internal storage choice is design.

Return concrete defects with path/heading and a proposed correction. Check that the correction preserves every original condition. Do not add rationale/status/tag metadata, registries or mandatory tracing. Retired IDs remain reserved. Never treat requirements as proof of implementation.

Example review: “Delete locally persisted aircraft from IndexedDB” leaks a mechanism and excludes future personal/account/cloud data. Replace it with a storage-agnostic erasure obligation covering all personal data under system control; specify confirmation and failure reporting as separate obligations. Reject grounding privacy retention in weighing-report age: data protection and aircraft data currency are different concerns.

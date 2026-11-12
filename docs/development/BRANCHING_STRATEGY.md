# Branching model

Use [CONTRIBUTING §2](../../CONTRIBUTING.md#2-branches-and-commits) for branches, signed commits and PR targets. Work branches start at fresh `origin/develop`; isolate concurrent jobs in worktrees. Releases go through reviewed release PRs to main and back to develop; urgent production fixes return to both branches.

Observe live branch protection and green required CI. Never force-push main/develop, bypass checks or discard another job’s changes. Auto-merge may be used where repository policy permits after independent review; it does not replace review or tests.

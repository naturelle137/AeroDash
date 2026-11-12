# 313: Development environments

Use a reproducible Node/pnpm environment for consistent builds and Playwright dependencies. The optional `.devcontainer/` config supports container-based editors; the local HQ environment uses the `web-dev` toolbox. Package manifests define the required Node/pnpm versions. Install dependencies with the frozen lockfile.

Run project checks inside that environment. Container availability does not prove tests passed; record actual commands/results. No host-level system changes are required for normal frontend work.

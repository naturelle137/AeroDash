# Development container

The optional Dev Container provides the configured Node environment and Playwright/Chromium dependencies. See `.devcontainer/devcontainer.json` and its Dockerfile for the actual image; use package.json for the required Node/pnpm versions.

Open the repository with a Dev Containers-capable editor and reopen it in the container. Run `pnpm install --frozen-lockfile`, then `pnpm dev`. Validate with `pnpm lint`, `pnpm test:unit` and the applicable [test commands](../docs/testing/TESTING.md). The local HQ environment instead uses the `web-dev` toolbox.

Docker socket access in the configuration targets the host daemon; frontend development itself needs no Docker-in-Docker service. Do not add privileged CI services for routine app checks.

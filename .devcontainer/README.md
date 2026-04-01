# AeroDash Dev Container

Same environment locally and in GitHub Actions: Node 20, Docker CLI, Playwright (Chromium).

## Local (VS Code / Cursor)

1. Open the repo in VS Code/Cursor and **Reopen in Container** (or use the Dev Containers extension).
2. **Docker**: The `docker-outside-of-docker` feature mounts your host Docker socket, so `docker` and `docker buildx` run against your host daemon. On Windows use Docker Desktop with the WSL2 backend.
3. After the container is up, run `npm run dev`, `npm run lint`, `npm run test:unit`, etc. as usual.

## GitHub Actions

- **`.github/workflows/ci-devcontainer.yml`** builds this image and runs `npm run lint` and `npm run test:unit` inside it so CI matches the dev container.
- The runner’s Docker is used to build and run the container; no Docker is required *inside* the container for that workflow.

### Running Docker inside the container in CI

If a job must run `docker build` or `docker run` *inside* the dev container (e.g. to build a production image), add a job that uses the Docker-in-Docker service. The job runs on the runner, so the DinD service is on `localhost`; pass it into the dev container via `host.docker.internal`:

```yaml
jobs:
  build-image-from-devcontainer:
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:dind
        options: --privileged
        ports:
          - 2375:2375
    steps:
      - uses: actions/checkout@v4
      - name: Build dev container
        run: docker build -f .devcontainer/Dockerfile -t dev .
      - name: Run Docker inside container (DinD)
        run: |
          docker run --rm \
            -v "${{ github.workspace }}:/workspace" \
            -w /workspace \
            --add-host=host.docker.internal:host-gateway \
            -e DOCKER_HOST=tcp://host.docker.internal:2375 \
            -e DOCKER_TLS_VERIFY= \
            dev \
            bash -lc "docker version && docker build -t myapp ./frontend"
```

Use this pattern only when a step must run Docker from inside the dev container.

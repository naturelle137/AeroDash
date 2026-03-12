# AeroDash dev container: Node 24, Docker CLI, Playwright
# Used locally (with Docker socket mount) and in GitHub Actions CI
# Editor extensions and Cursor/VS Code settings: see devcontainer.json "customizations"
FROM node:24-bookworm

# Install git, Docker CLI, and passwordless sudo for the node user
# (git and sudo are included in the devcontainers image but not in the official node image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    sudo \
    ca-certificates \
    curl \
    gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin \
    && apt-get clean && rm -rf /var/lib/apt/lists/* \
    && echo "node ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node

# Install Playwright system deps (root); browsers installed as node so cache is in correct home
RUN npx playwright install-deps chromium

WORKDIR /workspace

# Copy root and frontend package files for better layer caching (build context = repo root)
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies; then hand over to node (postCreateCommand re-runs after clone)
RUN npm i && chown -R node:node /workspace

USER node

# Playwright Chromium in node's home so e2e works in dev container and CI
RUN npx playwright install chromium

# Rest of repo is mounted at runtime
ENTRYPOINT ["/bin/bash"]
CMD ["-l"]

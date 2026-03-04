# syntax=docker/dockerfile:1.7

FROM node:22-bookworm AS builder

RUN corepack enable

WORKDIR /app

# Install dependencies first for cacheable layers.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile

# Build gateway runtime + upstream Control UI assets.
COPY . .
ENV OPENCLAW_A2UI_SKIP_MISSING=1
RUN pnpm build
ENV OPENCLAW_PREFER_PNPM=1
RUN pnpm ui:build
RUN pnpm prune --prod

FROM node:22-bookworm-slim

WORKDIR /home/node

ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/openclaw.mjs ./openclaw.mjs
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/extensions ./extensions
COPY --from=builder --chown=node:node /app/skills ./skills
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

EXPOSE 8080

USER node

CMD ["node", "openclaw.mjs", "gateway", "--allow-unconfigured", "--bind", "lan", "--port", "8080"]

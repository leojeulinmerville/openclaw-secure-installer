# syntax=docker/dockerfile:1.7
# OpenClaw Gateway – minimal single-file Node.js image.
# Context: ./gateway  (only openclaw.mjs lives here)

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /home/node

# The entire gateway is one self-contained ESM file – no build step needed.
COPY --chown=node:node openclaw.mjs ./openclaw.mjs

EXPOSE 8080

USER node

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "openclaw.mjs"]

FROM node:22-alpine

LABEL org.opencontainers.image.source="https://github.com/leojeulinmerville/openclaw-secure-installer"
LABEL org.opencontainers.image.description="OpenClaw Gateway – MVP"

WORKDIR /home/node

# Copy only what the gateway needs
COPY openclaw.mjs .

# Container listens on 8080 (unprivileged) — host port mapped via compose
ENV OPENCLAW_CONTAINER_PORT=8080
EXPOSE 8080

USER node

CMD ["node", "openclaw.mjs", "gateway"]

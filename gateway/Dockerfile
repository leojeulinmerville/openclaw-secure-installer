FROM node:22-alpine

LABEL org.opencontainers.image.source="https://github.com/leojeulinmerville/openclaw-secure-installer"
LABEL org.opencontainers.image.description="OpenClaw Gateway – MVP"

WORKDIR /home/node

# Copy only what the gateway needs
COPY openclaw.mjs .

# The compose template runs: ["node", "openclaw.mjs", "gateway"]
# We accept any trailing args gracefully.
EXPOSE 80

USER node

CMD ["node", "openclaw.mjs", "gateway"]

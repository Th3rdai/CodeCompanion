# ── Builder Stage ────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# ── Runtime Stage ────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy runtime files from builder
COPY --from=builder /app/server.js ./
COPY --from=builder /app/mcp-server.js ./
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/mcp ./mcp
COPY --from=builder /app/IDE_COMMANDS ./IDE_COMMANDS
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/routes ./routes

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=8900

# Expose application port
EXPOSE 8900

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8900/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the server
CMD ["node", "server.js"]

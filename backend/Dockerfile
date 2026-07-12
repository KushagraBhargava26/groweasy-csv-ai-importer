# Build stage — installs all deps (including dev) and compiles TypeScript
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Final stage — only production deps + compiled output, no source/dev tooling
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Runs as a non-root user rather than the default root — standard
# container security practice, costs nothing extra here since Alpine's
# node image already ships a built-in unprivileged "node" user.
USER node

EXPOSE 5000
CMD ["node", "dist/server.js"]
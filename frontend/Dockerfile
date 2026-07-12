# Build stage — installs deps and runs the Next.js production build
FROM node:20-alpine AS build
WORKDIR /app

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time,
# not read at runtime — so this must be a build ARG, passed via
# `docker build --build-arg`, not just an env var at `docker run`.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Final stage — only the standalone output + static assets, no source,
# no dev tooling, no full node_modules tree
FROM node:20-alpine
WORKDIR /app

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER node

EXPOSE 3000
CMD ["node", "server.js"]
# Stage 1: Build Frontend React App
FROM node:20-alpine AS frontend
WORKDIR /repo
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Install + compile TypeScript backend (shared/ available for path alias resolution)
FROM node:20-alpine AS backend-build
WORKDIR /repo
COPY backend-ts/package.json backend-ts/package-lock.json* backend-ts/
RUN cd backend-ts && npm ci
COPY shared/ shared/
COPY backend-ts/ backend-ts/
RUN cd backend-ts && npm run build

# Stage 3: Runtime — Node-only image serving /api/* and SPA static files on PORT=8080
FROM node:20-alpine
WORKDIR /app
COPY --from=backend-build /repo/backend-ts/node_modules ./node_modules
COPY --from=backend-build /repo/backend-ts/dist ./dist
COPY --from=backend-build /repo/backend-ts/package.json ./
COPY --from=frontend /repo/dist ./public

ENV PORT=8080
EXPOSE 8080

# Built layout:
#   dist/backend-ts/src/index.js  ← entrypoint
#   dist/shared/*.js              ← path-aliased imports resolve here
CMD ["node", "dist/backend-ts/src/index.js"]

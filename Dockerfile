# Stage 1: Build Frontend React App
FROM node:20-alpine AS frontend
WORKDIR /repo
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# public/data is a symlink to ../data for local dev. Cloud Build's source upload
# can lose or break symlinks, leaving Vite with no static data to copy into dist/.
# Replace the link with a real directory so the build is hermetic.
RUN rm -rf public/data && cp -r data public/data
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

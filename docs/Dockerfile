# syntax=docker/dockerfile:1
# The docs site: VitePress builds docs/ to static files, nginx serves them.
# Build from the repo root (the changelog page includes ../CHANGELOG.md):
#   docker build -f docs/Dockerfile .

FROM node:24-bookworm-slim AS build
WORKDIR /site
COPY docs/package*.json docs/
RUN npm ci --prefix docs
COPY docs docs
COPY CHANGELOG.md ./
RUN npm run build --prefix docs

FROM nginx:1.29-alpine
COPY docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site/docs/.vitepress/dist /usr/share/nginx/html

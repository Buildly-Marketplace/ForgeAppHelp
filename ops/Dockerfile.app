# ForgeAppHelp Application Container
#
# Two stages: the build stage runs whatever `npm run build` means for your
# framework, and the serve stage ships only the produced static files. Swapping
# React for Vue or Angular changes nothing here as long as `npm run build`
# writes to dist/ -- set BUILD_DIR if your framework writes somewhere else
# (Angular: dist/<project-name>, Next static export: out).

FROM node:20-alpine AS build

LABEL maintainer="Buildly Marketplace <marketplace@buildly.io>"
LABEL description="ForgeAppHelp build stage"

WORKDIR /app

# Copy manifests first so the dependency layer caches across source edits.
#
# --ignore-scripts is required, not optional: this package's `prepare` script
# compiles the library, and at this layer only the manifests exist -- src/ has
# not been copied yet. Without it the install fails trying to build nothing.
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts --no-audit --no-fund 2>/dev/null \
    || npm install --ignore-scripts --no-audit --no-fund

COPY . .
RUN npm run build

# -----------------------------------------------------------------------------

FROM nginx:1.27-alpine AS serve

LABEL maintainer="Buildly Marketplace <marketplace@buildly.io>"
LABEL description="ForgeAppHelp static server"

ARG BUILD_DIR=dist-demo
COPY --from=build /app/${BUILD_DIR} /usr/share/nginx/html
COPY ops/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8000

# curl is installed explicitly rather than relying on busybox wget: which
# applets the nginx alpine image ships has changed between releases, and a
# healthcheck that silently cannot run reports the container as unhealthy
# forever while nginx itself is serving fine.
RUN apk add --no-cache curl

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD curl -fsS http://localhost:8000/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]

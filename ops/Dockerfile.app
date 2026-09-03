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
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund

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

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:8000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

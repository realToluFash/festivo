# One image, every environment.
#
# Nothing environment-specific is baked in. The build produces static files and
# the entrypoint writes config.json from the container's environment at start-up
# — so the same image that ran in staging is the image that runs in production,
# and pointing it at a different API is an environment variable rather than a
# rebuild.
#
# The previous build took the API URL as a build argument. Changing it in
# compose silently did nothing, because the value was already inside the
# JavaScript. There was no error to find.

FROM node:22-alpine AS build
WORKDIR /repo

# The workspace root's manifests first, so a source change does not reinstall.
COPY package.json package-lock.json ./
COPY locales.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/api-client/package.json packages/api-client/
COPY apps/web/package.json apps/web/
# The root `prepare` script runs on npm ci, so the file it names has to be here.
# Copied on its own rather than with the whole scripts directory, so an unrelated
# script changing does not invalidate the dependency layer.
COPY scripts/install-hooks.mjs scripts/
RUN npm ci --workspace @soirely/web --include-workspace-root

COPY packages/domain packages/domain
COPY packages/api-client packages/api-client
COPY apps/web apps/web
RUN npm run build --workspace @soirely/web

FROM nginx:1.27-alpine AS serve

COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.d/40-soirely-config.sh
RUN chmod +x /docker-entrypoint.d/40-soirely-config.sh

EXPOSE 80

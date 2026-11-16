FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./

RUN npm ci

COPY frontend/ ./

RUN npm run build


FROM caddy:2-alpine

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

COPY LICENSE /srv/licenses/LICENSE.txt
COPY THIRD_PARTY_NOTICES.md /srv/licenses/THIRD_PARTY_NOTICES.txt
COPY docs/licenses/ /srv/licenses/

EXPOSE 80 443

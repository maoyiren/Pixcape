# Build Blockbench as a static sub-app served under /blockbench/.
FROM node:24-bookworm-slim AS blockbench-build
ARG BLOCKBENCH_REF=5b0c99cd5a0e0ef3d15f52e91e945672076022ac
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /blockbench
RUN git init \
    && git remote add origin https://github.com/liseezn/blockbench.git \
    && git fetch --depth=1 origin "$BLOCKBENCH_REF" \
    && git checkout --detach FETCH_HEAD
RUN npm ci && npm run build-web && test -s dist/bundle.js
RUN mkdir -p /runtime \
    && cp index.html favicon.png icon_full.png manifest.webmanifest LICENSE.MD /runtime/ \
    && cp -a assets css content dist font icons js keymaps lang lib themes /runtime/ \
    && test -s /runtime/dist/bundle.js \
    && test -s /runtime/LICENSE.MD

FROM node:24-bookworm-slim AS next-build
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force
COPY . .
RUN npm run next:build

FROM node:24-bookworm-slim AS ai-api-build
WORKDIR /ai-api
COPY ai-api/package*.json ./
RUN npm ci --omit=dev --include=optional --no-audit --no-fund
COPY ai-api/ ./

# Debian runtime matches the native Prisma SQLite addon built in next-build.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends bash nginx ca-certificates wget \
    && rm -f /etc/nginx/sites-enabled/default \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=127.0.0.1 NEXTAUTH_URL=https://cdpc.cc
WORKDIR /opt/pixcape-next
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=blockbench-build /runtime/ /usr/share/nginx/html/blockbench/
COPY --from=ai-api-build /ai-api /opt/pixcape-ai-api
COPY --from=next-build /app/package.json ./package.json
COPY --from=next-build /app/node_modules ./node_modules
COPY --from=next-build /app/generated ./generated
COPY --from=next-build /app/.next ./.next
COPY --from=next-build /app/public ./public
COPY --from=next-build /app/app ./app
COPY --from=next-build /app/pages ./pages
COPY --from=next-build /app/lib ./lib
COPY --from=next-build /app/prisma ./prisma
COPY --from=next-build /app/prisma.config.ts ./prisma.config.ts
COPY --from=next-build /app/scripts ./scripts
COPY --from=next-build /app/auth.ts ./auth.ts
COPY --from=next-build /app/next.config.ts ./next.config.ts
COPY --from=next-build /app/tsconfig.next.json ./tsconfig.next.json
COPY --from=next-build /app/next-env.d.ts ./next-env.d.ts
COPY docker-entrypoint-single.sh /usr/local/bin/docker-entrypoint-single.sh
COPY THIRD_PARTY_NOTICES.md /usr/share/nginx/html/THIRD_PARTY_NOTICES.md
RUN mkdir -p /data && chmod +x /usr/local/bin/docker-entrypoint-single.sh
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
ENTRYPOINT ["/usr/local/bin/docker-entrypoint-single.sh"]

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@10.33.2
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --config.manage-package-manager-versions=false
COPY . .
RUN pnpm --config.manage-package-manager-versions=false build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3100 HOSTNAME=0.0.0.0 DOTS_DATA_DIR=/data DOTS_SERVER_MODE=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3100
CMD ["node", "server.js"]

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production SERVE_STATIC=1 REQUIRE_PRODUCTION_SERVICES=1 PORT=8787
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/content ./src/content
COPY --from=build /app/migrations ./migrations
RUN mkdir -p /app/data/avatars /app/data/backups /app/data/logs && chown -R node:node /app/data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "require('http').get('http://127.0.0.1:8787/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server/index.js"]

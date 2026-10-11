FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.* ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3185 HOST=0.0.0.0 DATA_DIR=/data
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server ./server
COPY content ./content
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3185
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3185/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server/index.mjs"]

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY scripts ./scripts
USER node
EXPOSE 3000
# API: aplica migrações pendentes e sobe o servidor.
# O WORKER usa a MESMA imagem com outro comando de início:  node dist/worker
CMD ["sh", "-c", "node scripts/migrate.js && node dist/main"]

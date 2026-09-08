# Build a partir da raiz do monorepo — ver docker-compose.yml (context: .)
# e docs/08-reprodutibilidade-docker-github.md
FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json ./
COPY packages/db/package.json packages/db/package.json
COPY backend/package.json backend/package.json
COPY worker/package.json worker/package.json
COPY frontend/package.json frontend/package.json
RUN npm install
COPY packages/db packages/db
COPY backend backend
RUN npm run generate --workspace=@dmflow/db
RUN npm run build --workspace=@dmflow/backend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/db ./packages/db
COPY --from=build /repo/backend/dist ./backend/dist
COPY --from=build /repo/backend/package.json ./backend/package.json
WORKDIR /app/backend
USER node
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "dist/index.js"]

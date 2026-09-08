# Build a partir da raiz do monorepo — ver docker-compose.yml (context: .)
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /repo
COPY package.json ./
COPY packages/db/package.json packages/db/package.json
COPY backend/package.json backend/package.json
COPY worker/package.json worker/package.json
COPY frontend/package.json frontend/package.json
RUN npm install
COPY packages/db packages/db
COPY worker worker
RUN npm run generate --workspace=@dmflow/db
RUN npm run build --workspace=@dmflow/db
RUN npm run build --workspace=@dmflow/worker

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/db ./packages/db
COPY --from=build /repo/worker/dist ./worker/dist
COPY --from=build /repo/worker/package.json ./worker/package.json
WORKDIR /app/worker
USER node
CMD ["node", "dist/index.js"]

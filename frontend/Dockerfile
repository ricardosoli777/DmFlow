# Build a partir da raiz do monorepo — ver docker-compose.yml (context: .)
FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json ./
COPY packages/db/package.json packages/db/package.json
COPY backend/package.json backend/package.json
COPY worker/package.json worker/package.json
COPY frontend/package.json frontend/package.json
RUN npm install
COPY packages/db packages/db
COPY frontend frontend
RUN npm run generate --workspace=@dmflow/db
# NEXT_PUBLIC_* é gravado no bundle JS em build time, não lido em runtime do
# container — precisa ser passado como build-arg (ver docker-compose.yml e
# .github/workflows/release.yml), não só como env do container final.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace=@dmflow/frontend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# O server.js do modo "standalone" do Next.js só escuta em localhost/IPv6 por
# padrão dentro do container — sem isso, nem o healthcheck interno consegue
# conectar. Fix documentado oficialmente pelo Next.js pra Docker.
ENV HOSTNAME=0.0.0.0
COPY --from=build /repo/frontend/.next/standalone ./
COPY --from=build /repo/frontend/.next/static ./frontend/.next/static
COPY --from=build /repo/frontend/public ./frontend/public
USER node
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000 || exit 1
EXPOSE 3000
CMD ["node", "frontend/server.js"]

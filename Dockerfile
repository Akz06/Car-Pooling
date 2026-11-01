# Works on Railway, Fly.io, a VPS or anything that runs containers.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000 DATA_DIR=/data
COPY --from=build /app /app
VOLUME /data
EXPOSE 4000
HEALTHCHECK CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["npx", "tsx", "server/index.ts"]

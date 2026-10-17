FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --workspace @sidequest/api --workspace @sidequest/contracts --include-workspace-root

COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN npm run build:api && npm prune --omit=dev --workspace @sidequest/api --workspace @sidequest/contracts --include-workspace-root

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist

EXPOSE 3333
USER node
CMD ["npm", "run", "start:api"]

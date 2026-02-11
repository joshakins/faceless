FROM node:20-slim

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/

RUN pnpm --filter @faceless/shared build
RUN pnpm --filter @faceless/server build

WORKDIR /app/packages/server

RUN mkdir -p data

EXPOSE 3000

CMD ["node", "dist/index.js"]

FROM node:22-alpine AS base

RUN corepack enable pnpm

WORKDIR /app

# Dependencies
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Build
COPY . .
ARG NEXT_PUBLIC_API_URL=http://backend:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_ADSENSE_ID=
ARG NEXT_PUBLIC_AD_SLOT_HOME=
ARG NEXT_PUBLIC_AD_SLOT_SEARCH=
ARG NEXT_PUBLIC_AD_SLOT_PRODUCT=
ENV NEXT_PUBLIC_ADSENSE_ID=$NEXT_PUBLIC_ADSENSE_ID
ENV NEXT_PUBLIC_AD_SLOT_HOME=$NEXT_PUBLIC_AD_SLOT_HOME
ENV NEXT_PUBLIC_AD_SLOT_SEARCH=$NEXT_PUBLIC_AD_SLOT_SEARCH
ENV NEXT_PUBLIC_AD_SLOT_PRODUCT=$NEXT_PUBLIC_AD_SLOT_PRODUCT

RUN pnpm build

# Production
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=base --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=base --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=base --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]

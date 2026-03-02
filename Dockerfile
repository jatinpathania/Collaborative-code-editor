FROM node:18-alpine3.18 AS base
RUN apk add --no-cache libc6-compat openssl

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Install compilers and runners natively
RUN apk add --no-cache \
    python3 \
    g++ \
    gcc \
    openjdk17-jdk \
    libc6-compat \
    libc-dev

# Build-time verification: check if compilers are installed
RUN which python3 && which g++ && which gcc && which javac && which java

ENV NODE_ENV production

# Don't use a separate user for now to avoid permission issues with /tmp and compiler outputs
# If you want to use 'nextjs' user, ensure they have write access to /tmp and /app
# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# CMD ["node", "server.js"] is already the default for Next.js standalone,
# as it creates its own server.js in the standalone directory.
CMD ["node", "server.js"]

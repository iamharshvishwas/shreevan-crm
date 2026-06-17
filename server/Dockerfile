# Multi-stage build for the Shreevan CRM API.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# OpenSSL is required by Prisma's query/migration engines on Alpine.
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
EXPOSE 3000
# Apply any pending migrations on boot, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

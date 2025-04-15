FROM node:18-bullseye

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Install OpenSSL
RUN apt update && apt install -y openssl

# Install production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Remove CLI packages since we don't need them in production by default.
RUN npm remove @shopify/cli

COPY . .

# **Generate the Prisma client here** so your app can use @prisma/client at runtime
RUN npx prisma generate

# Build the Remix/Shopify app
RUN npm run build

# Start your production server
CMD ["sh", "-c", "npx prisma migrate deploy && npm run docker-start"]
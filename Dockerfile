FROM node:18-buster

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Устанавливаем OpenSSL 1.1 и сертификаты
RUN apt update && \
    apt install -y openssl libssl1.1 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN npm ci --omit=dev && npm cache clean --force
RUN npm remove @shopify/cli || true

COPY . .

RUN npx prisma generate
RUN npm run build

CMD ["sh", "-c", "npx prisma migrate deploy && npm run docker-start"]
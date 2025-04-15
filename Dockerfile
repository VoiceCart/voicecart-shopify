FROM node:18-bullseye

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Устанавливаем OpenSSL 1.1 и сертификаты
RUN apt update && \
    apt install -y openssl libssl1.1 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Установка production-зависимостей
RUN npm ci --omit=dev && npm cache clean --force

# Удаляем @shopify/cli (если он случайно ставится в build deps)
RUN npm remove @shopify/cli || true

COPY . .

# Генерация Prisma Client
RUN npx prisma generate

# Сборка Remix/Shopify app
RUN npm run build

# Старт с миграцией БД
CMD ["sh", "-c", "npx prisma migrate deploy && npm run docker-start"]

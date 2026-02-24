# Используем многоступенчатую сборку для минимизации размера образа

# Этап 1: Сборка приложения
FROM node:20-alpine AS build
ARG BUILD_TIME="unknown"
ENV VITE_BUILD_TIME=${BUILD_TIME}
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
# Используем npm install вместо npm ci для первой сборки после добавления новых пакетов
RUN npm install

# Копируем весь код
COPY . .

# Собираем приложение для production
RUN npm run build

# Этап 2: Production образ с nginx
FROM nginx:alpine AS final

# Устанавливаем curl для healthcheck
RUN apk add --no-cache curl

# Удаляем дефолтный конфиг nginx
RUN rm -rf /usr/share/nginx/html/*

# Копируем собранное приложение
COPY --from=build /app/dist /usr/share/nginx/html

# Копируем кастомный конфиг nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Создаем пользователя для запуска nginx (безопасность)
RUN addgroup -g 1000 -S appgroup && \
    adduser -u 1000 -S appuser -G appgroup && \
    chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid

# Переключаемся на непривилегированного пользователя
USER appuser

# Открываем порт
EXPOSE 80

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]

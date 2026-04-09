# docker/Dockerfile
FROM nginx:alpine

# Копируем все файлы приложения в директорию nginx
COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/

# Копируем папку public (иконки, маскоты, manifest, sw.js)
COPY public/ /usr/share/nginx/html/public/

# Копируем конфиг nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Устанавливаем правильные права
RUN chmod -R 755 /usr/share/nginx/html

# Открываем порт 80
EXPOSE 80

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]
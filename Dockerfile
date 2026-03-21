# Placeholder until Node/Vite app is added. Serves a static splash for health checks.
FROM nginx:1.27-alpine
RUN mkdir -p /var/changeoverlord/uploads
COPY docker/html/index.html /usr/share/nginx/html/index.html
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

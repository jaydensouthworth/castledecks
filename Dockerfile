# Static frontend only; no Node or application backend runs in production.
FROM nginx:1.30.5-alpine3.24
COPY site/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

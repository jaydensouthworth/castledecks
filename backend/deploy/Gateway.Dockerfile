FROM nginx:1.30.5-alpine3.24
COPY site/dist/ /usr/share/nginx/html/
COPY backend/deploy/nginx/off.conf /opt/castledecks/off.conf
COPY backend/deploy/nginx/accounts.conf /opt/castledecks/accounts.conf
COPY backend/deploy/bin/gateway-config.sh /docker-entrypoint.d/15-castledecks-config.sh
RUN chmod 755 /docker-entrypoint.d/15-castledecks-config.sh
# Gateway-only HTML derivation; repository site/dist and the main image stay off.
RUN ! grep -q 'castledecks-runtime.js' /usr/share/nginx/html/battle.html \
 && sed -i 's#</head>#<script src="/castledecks-runtime.js"></script></head>#' /usr/share/nginx/html/battle.html \
 && grep -q '<script src="/castledecks-runtime.js"></script>' /usr/share/nginx/html/battle.html
ENV ACCOUNT_ROUTES=false
EXPOSE 80

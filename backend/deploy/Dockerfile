# syntax=docker/dockerfile:1
# Template: resolve approved release image digests before production.
FROM golang:1.27.1-bookworm AS build
WORKDIR /src
COPY network/ network/
COPY go-lobby-checkpoint1/ go-lobby-checkpoint1/
WORKDIR /src/network
RUN --mount=type=secret,id=proxy_ca if [ -f /run/secrets/proxy_ca ]; then export SSL_CERT_FILE=/run/secrets/proxy_ca; fi; go mod download && go mod verify
RUN CGO_ENABLED=1 go build -trimpath -buildvcs=false -o /out/server ./cmd/server && CGO_ENABLED=1 go build -trimpath -buildvcs=false -o /out/recoveryctl ./cmd/recoveryctl && CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /out/healthcheck ./cmd/healthcheck
FROM debian:bookworm-slim
RUN apt-get update && apt-get install --no-install-recommends -y ca-certificates && rm -rf /var/lib/apt/lists/* && mkdir /data /journal && chown 10001:10001 /data /journal
COPY --from=build /out/server /out/healthcheck /out/recoveryctl /app/
COPY deploy/bin/entrypoint.sh /app/entrypoint.sh
USER 10001:10001
WORKDIR /data
ENV LISTEN_ADDR=0.0.0.0:8080 DATABASE_PATH=/data/accounts.sqlite ENABLE_ACCOUNTS=false ENABLE_PRIVATE_ROOMS=false
EXPOSE 8080
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]

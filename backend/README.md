# Castledecks Go accounts preparation

Accounts and private rooms remain disabled by default. This source provides Google OIDC account/session handling, revisioned cloud documents compatible with the accepted80 game codecs, and schema2 deletion-aware recovery. It does not port combat to the server. See RECOVERY.md for the durable journal and explicit recovery workflow.

## Local validation

Use Go1.27.1, a C compiler for SQLite and Python3:

```sh
cd network
go mod verify
go test -race -count=3 ./...
go vet ./...
go build -trimpath -buildvcs=false -o ../deploy/bin/server.test ./cmd/server
go build -trimpath -buildvcs=false -o ../deploy/bin/recoveryctl.test ./cmd/recoveryctl
cd ..
python3 -m unittest discover -s deploy/tests -v
```

Native process tests skip without those binaries; inspect the output. The optional Docker/Nginx exercise is `python3 ci/container_smoke.py`. It uses disposable volumes, fake policy values and a disabled identity provider. It does not publish or deploy anything. The proposed GitHub Actions workflow runs these checks with read-only repository permissions and no secrets.

## Deployment gates

The supplied Compose file defaults to static hosting and503 API responses. Account routing needs the accounts profile, explicit enablement, Google credential-file mounts, an existing deletion journal, an explicitly chosen retention policy, and the separate Nginx override. The frontend flag remains separately off. The sidecar has no host port; static local testing binds loopback8090. Dokploy integration requires verified TLS, hostname and proxy/client-IP handling rather than copying this local topology blindly.

Use the chosen origin https://castledecks.jaydensrealm.com and exact callback https://castledecks.jaydensrealm.com/api/auth/google/callback. Scope is openid only. Enter replacement credentials directly in approved protected configuration, never in repository/chat/build arguments. Source preparation does not authorize credential creation/storage, DNS/proxy changes or production activation.

Container images still require an actual successful CI build/run, verified image digests, and real provider/proxy/browser acceptance. Existing guest/local saves are origin-scoped: keep the old host and originals available, then explicitly export/preview/import on the new host. No automatic save migration is included.

The Go readiness endpoint checks provider configuration, schema2 readability and journal availability. It does not prove disk writeability, free space or a current Google roundtrip. Logs must not contain callback query strings, headers, cookies or document bodies. Backups contain personal account/save data even after sessions are scrubbed; approved private storage, independent checkpoint preservation, retention and deletion handling remain operator responsibilities.

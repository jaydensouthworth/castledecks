# Dokploy candidate setup

This is a separate Compose application on `backend-go-staging`. Do not change the existing static application's branch, Dockerfile or domain assignment during preparation. The new gateway image copies the repository's existing `site/dist` bytes; it does not enable the frontend account feature.

## First deploy: static only

Create a Compose service, choose Docker Compose (not Stack), select `jaydensouthworth/castledecks`, branch `backend-go-staging`, and Compose path `docker-compose.dokploy.yml`. In Environment, use:

```dotenv
COMPOSE_PROFILES=
ENABLE_ACCOUNTS=false
ACCOUNT_ROUTES=false
```

Deploy this candidate. Only `gateway` should start and become healthy. No credentials, file mounts or host filesystem paths are needed for this stage. The root Compose file is JSON-formatted YAML, accepted by Docker Compose. Builds use repository root for the gateway and `./backend` for Go. The Dockerfile-specific ignore file preserves the existing restrictive root `.dockerignore`.

Dokploy documents Git-backed Compose, environment configuration, and its separate Docker Compose/Stack modes in the [Compose guide](https://docs.dokploy.com/docs/core/docker-compose).

## Add the three files directly in Dokploy

After the retention decision and credential-storage approval, use Advanced → Mounts → File Mount. Create these filenames; the Compose already references their `../files/` locations:

- `google-client-id`: the web client's ID, raw text
- `google-client-secret`: the replacement secret, entered directly by the owner, raw text
- `recovery-policy.json`: the agreed non-secret policy JSON

These are admin-controlled files mounted read-only into the account service. File Mounts are not asserted to be an encrypted secret vault: restrict Dokploy/host administrator access, and use the established protected storage arrangement. Never paste credential contents into Git, chat, CI variables or screenshots. Mount files must be readable by the service's UID10001. No manual absolute server path is required. Follow Dokploy's [File Mount procedure](https://docs.dokploy.com/docs/core/troubleshooting/volumes-mounts); do not bind files directly from the cloned repository.

Suggested policy for a decision, NOT enabled by this repository:

- Seven-day backup eligibility and thirty-day deletion records: `{"backupHours":168,"tombstoneHours":720,"maxRecords":10000}`. More recovery time; retains minimal deletion records longer.
- One-day backup eligibility and two-day deletion records: `{"backupHours":24,"tombstoneHours":48,"maxRecords":10000}`. Shorter recovery window and earlier record pruning.

Both require actual backup expiry/pruning operations and independently preserved current journal/checkpoint storage. The application does not automatically delete backup files. The checked-in policy example remains invalid zeros. Do not select either policy silently.

## Initialize once, then start Go privately

With the policy file present, set only `COMPOSE_PROFILES=recovery-init`, keeping both enable flags false. Deploy. The `recovery-init` job must exit0 and print its non-secret journal checkpoint. Preserve that checkpoint through the agreed independent process. Initialization refuses to overwrite an existing journal; do not rerun it to recover a lost one.

Next replace the profile with `COMPOSE_PROFILES=accounts`, set `ENABLE_ACCOUNTS=true`, and leave `ACCOUNT_ROUTES=false`. Deploy. The Go service must become healthy before exposing its API. It reads the two credential mounts, opens the existing journal, reconciles deletion intents and verifies provider setup. Keep one service replica. The two named volumes are `account_data` and `deletion_data`; never remove them as a routine redeploy step.

## Domain and activation, after candidate health

With explicit approval for the domain routing change, use this Compose application's Domains tab: select service `gateway`, container port80, path `/`, and hostname `castledecks.jaydensrealm.com`; configure HTTPS in Dokploy. Remove any conflicting route for that same hostname only as part of the approved switch. Keep the old game hostname working for guest save export. Do not assign a domain or host port to `accounts` or `recovery-init`.

Use Preview Compose to verify that `gateway` retains the private network shared with `accounts` plus Dokploy's ingress network. Accounts must stay off the public ingress. Dokploy's [Compose Domains guide](https://docs.dokploy.com/docs/core/docker-compose/domains) explains native domain routing and Preview Compose.

Only after these checks set `ACCOUNT_ROUTES=true` and redeploy the gateway. Missing/unhealthy Go is a rollback condition: set routes false to restore static-only behavior. The existing frontend account flag still needs a separately coordinated activation. Verify the exact callback `https://castledecks.jaydensrealm.com/api/auth/google/callback`, real login/session behavior, actual trusted proxy path, account deletion/recovery and local-save origin migration before calling the system production-ready.

The candidate has no published host ports. Gateway health checks only static availability; Go has its own provider/database/journal readiness. API routing is never enabled automatically by merely entering credentials. The old public static application and its local saves remain available until an explicit migration choice.

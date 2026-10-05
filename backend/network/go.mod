module github.com/jaydensouthworth/castledecks/backend

go 1.27.1

require github.com/coder/websocket v1.8.15 // indirect

require (
	github.com/coreos/go-oidc/v3 v3.19.0
	github.com/go-jose/go-jose/v4 v4.1.4
	github.com/jaydensouthworth/castledecks/lobby v0.0.0
	github.com/mattn/go-sqlite3 v1.14.52
	golang.org/x/oauth2 v0.36.0
)

replace github.com/jaydensouthworth/castledecks/lobby => ../go-lobby-checkpoint1

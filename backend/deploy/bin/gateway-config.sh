#!/bin/sh
set -eu
case "${ACCOUNT_ROUTES:-false}" in
 false) cp /opt/castledecks/off.conf /etc/nginx/conf.d/default.conf ;;
 true) cp /opt/castledecks/accounts.conf /etc/nginx/conf.d/default.conf ;;
 *) echo 'ACCOUNT_ROUTES must be true or false' >&2; exit 78 ;;
esac

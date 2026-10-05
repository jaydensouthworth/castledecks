#!/bin/sh
set -eu
case "${ACCOUNT_ROUTES:-false}" in
 false) cp /opt/castledecks/off.conf /etc/nginx/conf.d/default.conf; account_flag=false ;;
 true) cp /opt/castledecks/accounts.conf /etc/nginx/conf.d/default.conf; account_flag=true ;;
 *) echo 'ACCOUNT_ROUTES must be true or false' >&2; exit 78 ;;
esac
# Only a fixed boolean reaches this public file; never serialize environment data.
printf "'use strict';\nwindow.CASTLEDECKS_ACCOUNTS = %s;\n" "$account_flag" > /usr/share/nginx/html/castledecks-runtime.js

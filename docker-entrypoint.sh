#!/bin/sh
# Applies pending Prisma migrations against the (volume-mounted) SQLite
# database, then starts the app. Runs on every container start; `prisma
# migrate deploy` is idempotent — it only applies migrations that haven't
# been applied yet, so restarts don't re-run anything destructively.
set -e

node node_modules/prisma/build/index.js migrate deploy

exec node dist/main.js

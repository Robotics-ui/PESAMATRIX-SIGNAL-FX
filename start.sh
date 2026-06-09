#!/bin/bash
set -e

echo "Starting Redis..."
redis-server --daemonize yes --logfile /tmp/redis.log --bind 127.0.0.1

echo "Waiting for Redis to be ready..."
until redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 0.2
done
echo "Redis is ready."

echo "Running database migrations..."
npx tsx src/lib/db/migrate.ts

echo "Starting PMatrix API server..."
exec npx tsx src/api-server/server.ts

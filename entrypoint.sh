#!/usr/bin/env sh
set -e

echo "Running database migrations..."
RETRIES=10
until npx prisma migrate deploy; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "Migrations failed after multiple attempts. Exiting."
    exit 1
  fi
  echo "Migration failed, retrying in 5s... ($RETRIES retries left)"
  sleep 5
done

echo "Starting server..."
exec npm run start

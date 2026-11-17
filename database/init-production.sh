#!/bin/sh
set -eu

: "${PULSE_APP_PASSWORD:?PULSE_APP_PASSWORD is required}"

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=pulse_app_password="$PULSE_APP_PASSWORD" \
  --file=/opt/pulse/init_schema.sql

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --file=/opt/pulse/kenya_geography_seed.sql

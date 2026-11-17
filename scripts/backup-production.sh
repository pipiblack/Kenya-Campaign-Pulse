#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file="$project_dir/.env.production"
compose_file="$project_dir/docker-compose.production.yml"
backup_dir="$project_dir/backups/postgres"

if [ ! -f "$env_file" ]; then
  echo "Missing $env_file" >&2
  exit 1
fi

set -a
. "$env_file"
set +a

retention_days=${BACKUP_RETENTION_DAYS:-14}
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_dir/pulse-kenya-$timestamp.dump"
temporary_file="$backup_file.partial"

mkdir -p "$backup_dir"
trap 'rm -f "$temporary_file"' EXIT HUP INT TERM

docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --no-owner' \
  > "$temporary_file"

mv "$temporary_file" "$backup_file"
trap - EXIT HUP INT TERM
find "$backup_dir" -type f -name 'pulse-kenya-*.dump' -mtime "+$retention_days" -delete

echo "PostgreSQL backup created: $backup_file"

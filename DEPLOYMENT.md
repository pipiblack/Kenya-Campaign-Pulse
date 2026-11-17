# Pulse Kenya self-hosting runbook

This deployment runs the complete application on one Linux server:

- Caddy is the only public service and terminates HTTPS on ports 80 and 443.
- Next.js and FastAPI are reachable only through Caddy.
- PostgreSQL and Redis have no host ports and live on a private Docker network.
- The NLP worker runs continuously beside the API.
- Named Docker volumes persist database, Redis and TLS state.

The production file is intentionally standalone. Always include `-f docker-compose.production.yml`; running plain `docker compose up` loads the development override.

## 1. Server and DNS

A practical starting server is 4 vCPU, 8 GB RAM and 80 GB SSD on a supported 64-bit Linux distribution. Increase memory when adding transformer models or several ingestion workers.

1. Create an `A` record for the chosen hostname, such as `pulse.example.com`, pointing to the server's public IPv4 address. Add an `AAAA` record only when IPv6 is configured correctly.
2. Allow inbound SSH, TCP 80, TCP 443 and UDP 443. Do not open 3000, 8000, 5432 or 6379.
3. Install Docker Engine and the Docker Compose plugin using the official instructions: <https://docs.docker.com/engine/install/>.
4. Confirm installation:

   ```bash
   docker version
   docker compose version
   ```

Caddy can issue and renew the public certificate when DNS points to the server and TCP ports 80 and 443 reach the container.

## 2. Copy and configure the application

Copy the repository to a stable path on the server, then work from its root directory.

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Generate independent hexadecimal secrets. Run this command separately for `POSTGRES_PASSWORD`, `PULSE_APP_PASSWORD`, `REDIS_PASSWORD` and `JWT_SECRET`:

```bash
openssl rand -hex 32
```

Edit `.env.production` and set:

- `PULSE_DOMAIN` to the public hostname without `https://`.
- `ACME_EMAIL` to the certificate-administration email.
- All four generated infrastructure secrets.
- The organisation name and tenant slug.
- A private initial administrator name, email and password of at least 16 characters.

Use URL-safe hexadecimal values for infrastructure passwords because they are embedded in internal database and Redis URLs.

### IP-only deployment beside an existing web server

If ports 80 and 443 are already occupied, expose Pulse on a dedicated HTTP
port without changing the existing website:

```dotenv
PULSE_DOMAIN=169.58.84.45
PULSE_PUBLIC_ORIGIN=http://169.58.84.45:8080
PULSE_HTTP_BIND=0.0.0.0:8080
PULSE_HTTPS_BIND=127.0.0.1:8443
PULSE_CADDYFILE=./deploy/Caddyfile.ip
```

The resulting link is `http://169.58.84.45:8080`. This mode intentionally
uses HTTP. Move to the standard domain configuration as soon as a hostname is
available so Caddy can provide public HTTPS.

## 3. Validate and start

Validate without printing the resolved secrets:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
```

Build and start the stack:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

The one-shot `bootstrap-admin` service replaces the known development account before FastAPI or Next.js can become healthy. Sign in using `INITIAL_TENANT_SLUG`, `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` from the protected environment file.

Check startup and certificate logs:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=200 caddy fastapi-backend nextjs-frontend
curl --fail --silent --show-error https://YOUR_DOMAIN/health/ready
```

Replace `YOUR_DOMAIN` with the configured hostname. A healthy response is JSON containing `"status":"ready"`.

## 4. Operations

Follow logs:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs -f --tail=200
```

Deploy an application update:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build --pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

Stop containers without deleting data:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml down
```

Never add `--volumes` on the production server unless permanently deleting PostgreSQL, Redis and Caddy state is intentional.

## 5. Backups

Create an immediate PostgreSQL backup:

```bash
./scripts/backup-production.sh
```

Backups are written to `backups/postgres` and old local files are removed according to `BACKUP_RETENTION_DAYS`. Copy backups to encrypted storage on another machine or provider; a backup that exists only on the application server will not survive a server or disk loss.

Example daily cron entry at 02:15 Africa/Nairobi time, when the server timezone is configured accordingly:

```cron
15 2 * * * cd /opt/pulse-kenya && ./scripts/backup-production.sh >> /var/log/pulse-kenya-backup.log 2>&1
```

Test restoration on a separate server before relying on the backup process. PostgreSQL is the system of record; Redis can be reconstructed from normal application activity after a restore.

## 6. Social API credentials

Add provider credentials only to `.env.production`, pass them to the relevant backend or worker service in `docker-compose.production.yml`, and recreate that service. Never use a `NEXT_PUBLIC_` variable for a private API token.

Webhook providers must call an HTTPS route under the configured public domain. Add each webhook path to the FastAPI router and keep `/api/*` behind Caddy so request signatures can be verified by the backend.

## 7. Minimum production controls

- Use SSH keys and disable password-based root login.
- Keep Docker, the host OS and container images patched.
- Register the data controller/processor and complete the relevant electoral-purpose and DPIA work before ingesting identifiable political data.
- Keep individual-level location and political profiling out of the product; publish aggregate geographic signals with confidence and sample-size indicators.
- Place an offsite backup and a restore test on a recurring schedule.
- Add host monitoring for disk, memory, container health, certificate errors and failed backups.

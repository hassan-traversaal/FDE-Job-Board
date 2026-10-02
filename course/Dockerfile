# Traversaal Academy: the whole app in one image, on one port.
#
# The build context is this folder, and .dockerignore lets in only what the app
# reads at runtime (app.py, backend/, data/, web/). .env, media/ and scripts/
# never reach an image, or Fly's builder.
#
#   docker build -t traversaal-academy .
#   docker run -p 8080:8080 -v "$PWD/.env:/app/.env:ro" traversaal-academy
#
# Mount .env rather than --env-file: backend/config.py's own parser then reads
# it, so the quoted GCP private key arrives exactly as it does locally (Docker's
# --env-file passes quotes through literally). On Fly the same values come from
# `fly secrets` and fly.toml's [env] instead; see fly.toml.
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first, in their own layer, so editing a page doesn't reinstall them.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app.py ./
COPY backend/ backend/
COPY data/ data/
COPY web/ web/

# The app never writes to disk (progress lives on the Clerk account, frames and
# signed URLs in memory), so it runs as a user that can't.
RUN useradd --system --no-create-home academy
USER academy

# Must match internal_port in fly.toml.
EXPOSE 8080

# One worker on purpose: the hourly question limit (auth._hits) and the caches
# live in this process's memory, and a second worker would keep its own count.
# --proxy-headers: only Fly's proxy can reach this port, so its X-Forwarded-*
# headers are trusted. --timeout-graceful-shutdown: a bot answer streams for
# 10-20 s, so on a deploy the old machine lets answers in flight finish
# (fly.toml's kill_timeout is longer than this).
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", \
     "--proxy-headers", "--forwarded-allow-ips", "*", "--timeout-graceful-shutdown", "25"]

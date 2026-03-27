# =============================================================================
# OT/ICS Cybersecurity Exposure Dashboard — Dockerfile
# Multi-stage build: minimise final image size while keeping the build clean.
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: builder — install Python dependencies into /install
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

# Build-time dependencies for packages that compile C extensions (asyncpg, etc.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy only requirements first — maximise layer cache reuse
COPY requirements.txt .

# Install all packages into a dedicated prefix so we can copy them cleanly
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: runtime — lean production image
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL maintainer="OT/ICS Security Dashboard Team" \
      description="OT/ICS Cybersecurity Exposure Dashboard API" \
      version="1.0.0"

# Runtime dependencies only (libpq for asyncpg, curl for healthcheck, cron for scheduler)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
        cron \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Create a non-root user for security
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --no-create-home --shell /sbin/nologin appuser

WORKDIR /app

# Copy application source code
COPY --chown=appuser:appgroup app/        ./app/
COPY --chown=appuser:appgroup db/         ./db/
COPY --chown=appuser:appgroup sql/        ./sql/
COPY --chown=appuser:appgroup ingestion/  ./ingestion/
COPY --chown=appuser:appgroup requirements.txt .

# Switch to non-root user
USER appuser

# Expose the API port
EXPOSE 8000

# Healthcheck — hits the /health liveness probe
HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=15s \
    --retries=3 \
    CMD curl --fail --silent http://localhost:8000/health || exit 1

# Start the application via uvicorn
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1"]

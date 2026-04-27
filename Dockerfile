# Stage 1: Build Frontend React App
FROM node:20-alpine AS frontend-builder

WORKDIR /app
RUN npm install -g pnpm

# Install dependencies and build
COPY package.json pnpm-lock.yaml* ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Build FastAPI Backend server
FROM python:3.12-slim

WORKDIR /app

# System dependencies for psycopg2/pg_config etc if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/app/ app/
COPY backend/alembic/ alembic/
COPY backend/alembic.ini .

# Copy compiled frontend from Stage 1 into the `dist/` folder
COPY --from=frontend-builder /app/dist /app/dist

# Cloud Run injects PORT
ENV PORT=8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

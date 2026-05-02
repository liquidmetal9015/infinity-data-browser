# Infinity Data Explorer: Production Deployment Guide

This guide details the steps required to deploy the unified React + Hono application to Google Cloud Platform (GCP). The frontend is a Vite-built SPA; the backend is a Hono + Drizzle Node service. Both ship in a single container behind one Cloud Run service, with the SPA served as static files and `/api/*` handled by Hono.

## 1. Prerequisites

Before beginning, ensure you have the following ready:
- The [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (`gcloud`) installed and authenticated.
- A GCP Project created with billing enabled.
- API access enabled for **Cloud Run**, **Cloud SQL**, **Secret Manager**, and **Cloud Build**.

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com
```

## 2. Setting Up the Production Database (Cloud SQL)

The application needs Postgres for user accounts, saved army lists, and AI usage counters (only — game catalog data is served as static JSON from the SPA bundle, not from the database).

1. **Create the Cloud SQL Instance**:
```bash
gcloud sql instances create infinity-db-instance \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1
```

2. **Create the Database and User**:
```bash
gcloud sql databases create infinity --instance=infinity-db-instance
gcloud sql users set-password postgres --instance=infinity-db-instance --password=YOUR_SECURE_PASSWORD
```

3. **Run Drizzle migrations** (via Cloud SQL Auth Proxy). Download the proxy if needed:
```bash
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy
```

```bash
# In terminal 1:
./cloud-sql-proxy YOUR_PROJECT_ID:us-central1:infinity-db-instance --port 5433

# In terminal 2:
export DATABASE_URL="postgresql://postgres:YOUR_SECURE_PASSWORD@127.0.0.1:5433/infinity"
cd backend-ts/
npm run db:migrate
```

There is **no separate seeding step** — the catalog data ships with the SPA in `data/processed/` and is read directly by the frontend Database singleton, the backend agent's `GameDataLoader`, and the MCP server's `DatabaseAdapter`.

## 3. Configuring Secrets (Firebase Admin)

The backend requires the `firebase-adminsdk.json` service account key to validate frontend Google Auth JWTs.

1. **Create the Secret**:
```bash
gcloud secrets create firebase-admin-key --replication-policy="automatic"
```

2. **Upload your Local Service Account Key**:
*(Ensure your `firebase-adminsdk.json` is safely stored locally and is gitignored. The repo's `.gitignore` already excludes `*firebase-adminsdk*.json`.)*
```bash
gcloud secrets versions add firebase-admin-key --data-file="firebase-adminsdk.json"
```

## 4. Deploying to Cloud Run

The multi-stage `Dockerfile` at the repo root builds the SPA with `npm run build`, builds the backend with `cd backend-ts && npm run build`, and produces a single Node image that serves the SPA from `./dist` and `/api/*` from Hono.

1. **Grant Secret Access to Compute Account**:
Identify your default Compute Engine Service Account (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`) and grant it the `Secret Accessor` role.
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:YOUR_COMPUTE_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"
```

2. **Run the Deployment**:
Update `YOUR_PROJECT_ID` and password below, then execute:

```bash
gcloud run deploy infinity-data-explorer \
    --source . \
    --region us-central1 \
    --allow-unauthenticated \
    --add-cloudsql-instances YOUR_PROJECT_ID:us-central1:infinity-db-instance \
    --set-env-vars="DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@/infinity?host=/cloudsql/YOUR_PROJECT_ID:us-central1:infinity-db-instance,CORS_ORIGINS=[\"*\"]" \
    --set-secrets="FIREBASE_ADMIN_CREDENTIALS=firebase-admin-key:latest"
```

`DEV_AUTH` must be unset in production. The backend asserts this on startup and refuses to boot if `NODE_ENV=production` and `DEV_AUTH=true`.

## 5. Finalizing Environments

Once Cloud Run outputs your Service URL (e.g., `https://infinity-data-explorer-xxx-uc.a.run.app`), your application is live!

- All API routes resolve under `/api/*` (handled by Hono).
- Static SPA assets and the SPA fallback are served by `serveStatic` middleware in `backend-ts/src/app.ts`. The frontend does not need a `VITE_API_URL` because both halves run behind the same origin.

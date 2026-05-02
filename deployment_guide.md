# Infinity Data Explorer: Production Deployment Guide

This guide details the steps required to deploy the unified React+FastAPI application to Google Cloud Platform (GCP).

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

Our application requires PostgreSQL to store the game state models. We will deploy a managed Cloud SQL instance.

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

3. **Run Initial Migrations** (via Cloud SQL Auth Proxy):
From your local environment, use the Cloud SQL Auth proxy to temporarily connect to the database and apply the Drizzle migrations. First, download the proxy if you don't have it:
```bash
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy
```

```bash
# In terminal 1:
./cloud-sql-proxy YOUR_PROJECT_ID:us-central1:infinity-db-instance --port 5433

# In terminal 2 — apply schema migrations (Drizzle, in backend-ts/):
export DATABASE_URL="postgresql://postgres:YOUR_SECURE_PASSWORD@127.0.0.1:5433/infinity"
cd backend-ts/
npm run db:migrate

# Then seed Corvus Belli game data via the Python ETL:
cd ../backend/
DATABASE_URL="postgresql+asyncpg://postgres:YOUR_SECURE_PASSWORD@127.0.0.1:5433/infinity" \
    PYTHONPATH=. uv run python -m app.etl.import_json
```

## 3. Configuring Secrets (Firebase Admin)

Our backend requires the `firebase-adminsdk.json` service account key to validate frontend Google Auth JWTs.

1. **Create the Secret**:
```bash
gcloud secrets create firebase-admin-key --replication-policy="automatic"
```

2. **Upload your Local Service Account Key**:
*(Ensure your `firebase-adminsdk.json` is safely stored on your machine but omitted from `.gitignore`!)*
```bash
gcloud secrets versions add firebase-admin-key --data-file="firebase-adminsdk.json"
```

## 4. Deploying to Cloud Run

We can deploy directly from source using the multi-stage `Dockerfile` written at the workspace root. Cloud Build will seamlessly provision both the `pnpm run build` static artifact compilation and the `uvicorn` Python containerization, unifying them into a single artifact.

1. **Grant Secret Access to Compute Account**:
Identify your default Compute Engine Service Account (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`) and grant it the `Secret Accessor` role.
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:YOUR_COMPUTE_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"
```

2. **Run the Deployment**:
Update `YOUR_PROJECT_ID` and password below, and execute the deployment script.

```bash
gcloud run deploy infinity-data-explorer \
    --source . \
    --region us-central1 \
    --allow-unauthenticated \
    --add-cloudsql-instances YOUR_PROJECT_ID:us-central1:infinity-db-instance \
    --set-env-vars="DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@/infinity?host=/cloudsql/YOUR_PROJECT_ID:us-central1:infinity-db-instance,CORS_ORIGINS=*" \
    --set-secrets="FIREBASE_ADMIN_CREDENTIALS=firebase-admin-key:latest"
```

## 5. Finalizing Environments

Once Cloud Run outputs your Service URL (e.g., `https://infinity-data-explorer-xxx-uc.a.run.app`), your application is live!

- All API routes are located dynamically under `/api/*`
- All frontend static interactions are mapped back to `index.html` via the SPA-fallback router implemented in `main.py`. Note that you do not need to supply a `VITE_API_URL` to your UI codebase anymore! Because both React and FastAPI run behind the absolute same domain, TanStack query fetches hitting `/api/lists` will resolve relatively with 0 latency overhead constraints! 

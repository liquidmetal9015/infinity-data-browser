# Deployment Postmortem: Infinity Data Explorer

This document catalogs the exact pitfalls, edge cases, and systemic errors encountered while migrating the Infinity Data Explorer to a production-grade infrastructure on Google Cloud Platform, using Cloud Run, Cloud SQL, and GitHub Actions CI/CD workflows. 

---

### 1. Cloud Run Secret Authentication Crash
**The Error:** `Permission denied on secret: projects/.../secrets/firebase-admin-key/versions/latest for Revision service account`
**The Context:** We uploaded the `firebase-adminsdk.json` file into Google Secret Manager and attempted to mount it natively into the Cloud Run environment template.
**The Pitfall:** Even though the developer who ran the command was an Owner of the GCP project, Cloud Run revisions authenticate against the default compute engine service account (`[PROJECT_NUMBER]-compute@developer.gserviceaccount.com`).
**The Resolution:** We bound the `roles/secretmanager.secretAccessor` explicitly to the Cloud Run compute service account, allowing the container to decrypt the Firebase credentials upon boot.

---

### 2. Pydantic List Parsing causing Uvicorn Health Check Failures
**The Error:** `The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable.`
**The Context:** We passed `--set-env-vars="CORS_ORIGINS=*"` via `gcloud` deployment flag.
**The Pitfall:** Uvicorn silently crashed during container boot. Running locally revealed `pydantic_settings.exceptions.SettingsError`. Pydantic V2 strictly enforces JSON-compliant syntax when parsing list structures from environment strings. A literal `*` fails JSON decoding.
**The Resolution:** Environment lists mapped to Pydantic MUST be passed as stringified JSON arrays. We modified the pipeline injections to pass `CORS_ORIGINS=["*"]` universally.

---

### 3. Vite SPA Routing Base Collision
**The Error:** Navigating to the live Cloud Run URL produces a perfectly valid HTTP Status 200, but the screen renders entirely blank white.
**The Context:** The legacy Single Page Application (SPA) was previously hosted on GitHub pages as a subdirectory branch (`base: '/infinity-data-browser/'`).
**The Pitfall:** Cloud Run routes to the absolute root of the domain (`/`). The React `index.html` was rendered via the FastAPI fallback, but the browser was searching for JavaScript bundles inside the hallucinated `/infinity-data-browser/assets/` pathway. Because the fallback caught the request, it returned `index.html` again instead of the JS payload.
**The Resolution:** Modified `vite.config.ts` to build out with `base: '/'`. 

---

### 4. Workload Identity Provider "Invalid Target" Sync Delays
**The Error:** `failed to generate Google Cloud federated token... error="invalid_target"... The target service indicated by the "audience" parameters is invalid.`
**The Context:** The newly integrated GitHub action attempted to assume a Google Cloud Identity securely via OIDC.
**The Pitfall:** Immediately upon `gcloud` provisioning the `github-actions-pool`, the Action ran. Google Cloud's globally distributed IAM identity cluster forces roughly a ~5 minute propagation delay on new Workload IAM federation targets. The action failed simply because the server hadn't registered its existence.
**The Resolution:** Simply waited 5 minutes and clicked "Re-run all jobs" in GitHub Actions.

---

### 5. Workload Federation Demanding Strict Constraints
**The Error:** `INVALID_ARGUMENT: The attribute condition must reference one of the provider's claims.`
**The Context:** Running the `gcloud iam workload-identity-pools providers create-oidc` command to hook GitHub tokens into Google auth.
**The Pitfall:** Google silently instituted a rigorous security posture. You can no longer provision an upstream identity pipeline without actively declaring a strict string validation condition, otherwise any GitHub worker block theoretically could assume the role.
**The Resolution:** Appended `--attribute-condition="assertion.repository == 'liquidmetal9015/infinity-data-browser'"` explicitly enforcing the handshake perimeter.

---

### 6. GitHub Secret Context Mashing (Database Password Corruption)
**The Error:** `asyncpg.exceptions.InvalidPasswordError: password authentication failed for user "postgres"`
**The Context:** The GitHub Action spun up the Cloud SQL proxy locally and ran `alembic upgrade head`.
**The Pitfall:** The action workflow constructs the DB string natively using `.yml` interpolation: `DATABASE_URL: 'postgresql+asyncpg://postgres:${{ secrets.DB_PASSWORD }}@127.0.0.1:5432/infinity'`. The repository secret `DB_PASSWORD` was populated with the *entire* connection string rather than exclusively just the password characters. The interpolation double-stacked the protocols resulting in a corrupted password string.
**The Resolution:** Pruned the GitHub `DB_PASSWORD` secret to uniquely hold the literal password string exactly.

---

### 7. Google's Setup-CloudSQL-Proxy Action is Not Supported
**The Error:** `Unable to resolve action google-github-actions/setup-cloudsql-proxy, repository not found`
**The Context:** Copied standard `.yml` pipelines to bind Alembic against the remote live database within the GitHub workflow runner block.
**The Pitfall:** Google officially purged and deprecated `google-github-actions/setup-cloudsql-proxy`.
**The Resolution:** Rewrote the GitHub action YAML to manually compile the Proxy tunnel via bash: `curl -o cloud-sql-proxy ...` and boot it in the background `&` natively inside the shell step parameters before spinning the Alembic migration loop.

---

### 8. Cloud Build from Source Recursive Role Constraints
**The Error:** `PERMISSION_DENIED: The caller does not have permission. This command is authenticated as github-actions-sa...`
**The Context:** Passing `--source .` back exclusively into a `gcloud run deploy` action block via the automated GitHub Action identity service account.
**The Pitfall:** Specific primitive assignments (like `Artifact Registry Admin` and `Cloud Run Admin`) are functionally useless for source deployments. `--source .` leverages an implicit automated pipeline triggering Cloud Storage uploads and Cloud Build environments. 
**The Resolution:** Escaped the complex granular binding mappings by upgrading the specific action runner workspace service account to `roles/editor` giving it unilateral authority across the isolated project space.

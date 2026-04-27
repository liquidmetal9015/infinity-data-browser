# 1. Cloud SQL Database Instance
resource "google_sql_database_instance" "postgres" {
  name             = "infinity-db-instance"
  database_version = "POSTGRES_15"
  region           = var.region
  
  settings {
    tier = "db-f1-micro"
  }
  
  # Prevent accidental destruction in production!
  deletion_protection = false 
}

# Database Catalog Workspace
resource "google_sql_database" "infinity_db" {
  name     = "infinity"
  instance = google_sql_database_instance.postgres.name
}

# PostgreSQL User Identity
resource "google_sql_user" "postgres_user" {
  name     = "postgres"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

# 2. Secret Manager Configuration
resource "google_secret_manager_secret" "firebase_admin" {
  secret_id = "firebase-admin-key"
  replication {
    auto {}
  }
}
# Note: The actual JSON key version is attached outside IaC to prevent committing keys to github

# 3. Cloud Run Service Definition
resource "google_cloud_run_v2_service" "api" {
  name     = "infinity-data-explorer"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      # This points to whatever Image GitHub Actions just finished building
      image = "us-docker.pkg.dev/cloudrun/container/hello" 
      
      env {
        name  = "DATABASE_URL"
        value = "postgresql+asyncpg://postgres:${var.db_password}@/infinity?host=/cloudsql/${var.project_id}:${var.region}:${google_sql_database_instance.postgres.name}"
      }
      env {
        name  = "CORS_ORIGINS"
        value = "[\"*\"]"
      }
      
      env {
        name = "FIREBASE_ADMIN_CREDENTIALS"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.firebase_admin.secret_id
            version = "latest"
          }
        }
      }
      
      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }
    
    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.postgres.connection_name]
      }
    }
  }
  
  # We ignore image changes so external CD drops don't cause Terraform to rollback
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image
    ]
  }
}

# Assign unauthenticated invoker role (Public Internet Facing)
data "google_iam_policy" "noauth" {
  binding {
    role    = "roles/run.invoker"
    members = ["allUsers"]
  }
}
resource "google_cloud_run_v2_service_iam_policy" "noauth" {
  location    = google_cloud_run_v2_service.api.location
  project     = google_cloud_run_v2_service.api.project
  name        = google_cloud_run_v2_service.api.name
  policy_data = data.google_iam_policy.noauth.policy_data
}

# Grant Cloud Run Service Account access to decode Firebase Key
data "google_project" "project" {}
resource "google_secret_manager_secret_iam_member" "secret_access" {
  secret_id = google_secret_manager_secret.firebase_admin.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}


# ==========================================
# 4. CI/CD: Workload Identity Federation
# Enables extremely secure keyless GitHub Actions
# ==========================================

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions Pool"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions-provider"
  display_name                       = "GitHub Actions Provider"
  
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }
  
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Native Service Account for remote Github Action machines to pretend to be
resource "google_service_account" "github_actions" {
  account_id   = "github-actions-sa"
  display_name = "Service Account for GitHub Actions Deployments"
}

# Fuse Workload Identity Pool specifically to the user's repository via subject string
resource "google_service_account_iam_member" "github_actions_wif" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

# Grant GitHub Actions permissions to touch infrastructure
resource "google_project_iam_member" "github_actions_run" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client" # Critical: Allows Action proxy to tunnel Alembic
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_artifact" {
  project = var.project_id
  role    = "roles/artifactregistry.admin" # Allows Docker image push
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

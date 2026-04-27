variable "project_id" {
  type        = string
  description = "The GCP Project ID"
  default     = "infinity-os-494622"
}

variable "region" {
  type        = string
  description = "The GCP Region"
  default     = "us-central1"
}

variable "db_password" {
  type        = string
  description = "PostgreSQL password for the database"
  sensitive   = true
}

variable "github_repo" {
  type        = string
  description = "GitHub repository (username/repo) for CI/CD access to Workload Identity Federation"
  default     = "liquidmetal9015/infinity-data-browser"
}

variable "project" {
  description = "Short lowercase project slug used in Azure resource names and tags."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,12}$", var.project))
    error_message = "project must be lowercase, start with a letter, and match ^[a-z][a-z0-9-]{1,12}$."
  }
}

variable "environment" {
  description = "Deployment environment name."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "location" {
  description = "Azure region for environment resources."
  type        = string
}

variable "app_image_tag" {
  description = "Container image tag for the app runtime and default migration job."
  type        = string

  validation {
    condition     = length(trimspace(var.app_image_tag)) > 0
    error_message = "app_image_tag must be non-empty."
  }
}

variable "worker_image_tag" {
  description = "Container image tag for the worker runtime."
  type        = string

  validation {
    condition     = length(trimspace(var.worker_image_tag)) > 0
    error_message = "worker_image_tag must be non-empty."
  }
}

variable "migration_image_tag" {
  description = "Container image tag for the migration job. Empty means reuse app_image_tag."
  type        = string
  default     = ""
}

variable "base_path" {
  description = "Base path served by the app runtime."
  type        = string
  default     = "/app-starter"
}

variable "custom_domain" {
  description = "Optional custom domain. Empty uses the default Container Apps FQDN."
  type        = string
  default     = ""
}

variable "postgres_sku" {
  description = "Azure Database for PostgreSQL Flexible Server SKU."
  type        = string
  default     = "B_Standard_B1ms"
}

variable "postgres_storage_gb" {
  description = "PostgreSQL storage size in GiB."
  type        = number
  default     = 32

  validation {
    condition     = var.postgres_storage_gb >= 32
    error_message = "postgres_storage_gb must be at least 32."
  }
}

variable "app_min_replicas" {
  description = "Minimum app replicas."
  type        = number
  default     = 0

  validation {
    condition     = var.app_min_replicas >= 0
    error_message = "app_min_replicas must be zero or greater."
  }
}

variable "app_max_replicas" {
  description = "Maximum app replicas."
  type        = number
  default     = 2

  validation {
    condition     = var.app_max_replicas >= var.app_min_replicas
    error_message = "app_max_replicas must be greater than or equal to app_min_replicas."
  }
}

variable "worker_min_replicas" {
  description = "Minimum worker replicas."
  type        = number
  default     = 1

  validation {
    condition     = var.worker_min_replicas >= 0
    error_message = "worker_min_replicas must be zero or greater."
  }
}

variable "enable_mail" {
  description = "Whether mail integration secrets are required."
  type        = bool
  default     = false
}

variable "enable_teams" {
  description = "Whether Teams integration secrets are required."
  type        = bool
  default     = false
}

variable "allow_destroy_persistent" {
  description = "Explicit opt-in for destructive changes to persistent data resources."
  type        = bool
  default     = false
}

variable "vnet_address_space" {
  description = "Virtual network address space."
  type        = list(string)
  default     = ["10.42.0.0/16"]
}

variable "container_apps_subnet_address_prefix" {
  description = "Subnet address prefix delegated to Azure Container Apps."
  type        = string
  default     = "10.42.0.0/23"
}

variable "postgres_subnet_address_prefix" {
  description = "Subnet address prefix delegated to Azure Database for PostgreSQL Flexible Server."
  type        = string
  default     = "10.42.2.0/24"
}

variable "tags" {
  description = "Additional tags merged into standard environment tags."
  type        = map(string)
  default     = {}
}

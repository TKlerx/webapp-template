variable "name_prefix" {
  description = "Environment name prefix used for Azure resource names."
  type        = string
}

variable "resource_group_name" {
  description = "Environment resource group name."
  type        = string
}

variable "location" {
  description = "Azure region for runtime resources."
  type        = string
}

variable "container_apps_subnet_id" {
  description = "Delegated Container Apps subnet id."
  type        = string
}

variable "log_analytics_workspace_id" {
  description = "Log Analytics workspace id for Container Apps logs."
  type        = string
}

variable "app_insights_connection_string" {
  description = "Application Insights connection string."
  type        = string
  sensitive   = true
}

variable "registry_login_server" {
  description = "ACR login server."
  type        = string
}

variable "runtime_identity_id" {
  description = "User-assigned managed identity resource id."
  type        = string
}

variable "app_image_ref" {
  description = "Full app container image reference."
  type        = string
}

variable "worker_image_ref" {
  description = "Full worker container image reference."
  type        = string
}

variable "migration_image_ref" {
  description = "Full migration container image reference."
  type        = string
}

variable "app_min_replicas" {
  description = "Minimum app replicas."
  type        = number
}

variable "app_max_replicas" {
  description = "Maximum app replicas."
  type        = number
}

variable "worker_min_replicas" {
  description = "Minimum worker replicas."
  type        = number
}

variable "base_path" {
  description = "Application base path."
  type        = string
}

variable "custom_domain" {
  description = "Optional custom domain."
  type        = string
}

variable "admin_database_url_secret_id" {
  description = "Key Vault secret id for admin database URL, scoped to the migration job."
  type        = string
}

variable "app_database_url_secret_id" {
  description = "Key Vault secret id for app database URL."
  type        = string
}

variable "worker_database_url_secret_id" {
  description = "Key Vault secret id for worker database URL."
  type        = string
}

variable "migration_database_url_secret_id" {
  description = "Key Vault secret id for migration database URL."
  type        = string
}

variable "better_auth_secret_id" {
  description = "Key Vault secret id for Better Auth secret."
  type        = string
}

variable "initial_admin_email_secret_id" {
  description = "Key Vault secret id for the initial admin email."
  type        = string
}

variable "initial_admin_password_secret_id" {
  description = "Key Vault secret id for the initial admin password."
  type        = string
}

variable "tags" {
  description = "Tags applied to runtime resources."
  type        = map(string)
}

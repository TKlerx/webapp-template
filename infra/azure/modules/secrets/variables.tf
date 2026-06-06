variable "name_prefix" {
  description = "Environment name prefix used for Azure resource names."
  type        = string
}

variable "name_suffix" {
  description = "Deterministic suffix for globally unique names."
  type        = string
}

variable "resource_group_name" {
  description = "Environment resource group name."
  type        = string
}

variable "location" {
  description = "Azure region for secret resources."
  type        = string
}

variable "tenant_id" {
  description = "Azure tenant id."
  type        = string
}

variable "runtime_identity_principal_id" {
  description = "Runtime managed identity principal id."
  type        = string
}

variable "deployment_identity_object_id" {
  description = "Deployment service principal object id."
  type        = string
}

variable "private_endpoint_subnet_id" {
  description = "Private endpoint subnet resource id."
  type        = string
}

variable "virtual_network_id" {
  description = "Environment virtual network id."
  type        = string
}

variable "admin_database_url" {
  description = "Admin database URL stored in Key Vault for migration job role provisioning only."
  type        = string
  sensitive   = true
}

variable "app_database_url" {
  description = "App database URL stored in Key Vault."
  type        = string
  sensitive   = true
}

variable "worker_database_url" {
  description = "Worker database URL stored in Key Vault."
  type        = string
  sensitive   = true
}

variable "migration_database_url" {
  description = "Migration database URL stored in Key Vault."
  type        = string
  sensitive   = true
}

variable "secret_expiration_date" {
  description = "RFC3339 expiration date applied to generated Key Vault secrets."
  type        = string
}

variable "initial_admin_email" {
  description = "Initial admin email stored in Key Vault."
  type        = string
}

variable "enable_mail" {
  description = "Reserved flag for optional mail secrets."
  type        = bool
}

variable "enable_teams" {
  description = "Reserved flag for optional Teams secrets."
  type        = bool
}

variable "tags" {
  description = "Tags applied to secret resources."
  type        = map(string)
}

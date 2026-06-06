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
  description = "Azure region for data resources."
  type        = string
}

variable "delegated_subnet_id" {
  description = "Delegated PostgreSQL subnet resource id."
  type        = string
}

variable "private_dns_zone_id" {
  description = "PostgreSQL private DNS zone id."
  type        = string
}

variable "postgres_sku" {
  description = "PostgreSQL Flexible Server SKU."
  type        = string
}

variable "postgres_storage_gb" {
  description = "PostgreSQL storage in GiB."
  type        = number
}

variable "allow_destroy_persistent" {
  description = "Reserved explicit opt-in for destructive persistent-resource operations."
  type        = bool
}

variable "tags" {
  description = "Tags applied to data resources."
  type        = map(string)
}

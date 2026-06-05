output "resource_group_name" {
  description = "Environment resource group name."
  value       = azurerm_resource_group.environment.name
}

output "virtual_network_id" {
  description = "Environment virtual network resource id."
  value       = module.network.virtual_network_id
}

output "container_apps_subnet_id" {
  description = "Delegated subnet resource id for Azure Container Apps."
  value       = module.network.container_apps_subnet_id
}

output "postgres_subnet_id" {
  description = "Delegated subnet resource id for PostgreSQL Flexible Server."
  value       = module.network.postgres_subnet_id
}

output "postgres_private_dns_zone_id" {
  description = "Private DNS zone id for PostgreSQL Flexible Server private access."
  value       = module.network.postgres_private_dns_zone_id
}

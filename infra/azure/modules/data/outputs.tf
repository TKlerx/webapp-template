output "database_host" {
  description = "PostgreSQL Flexible Server FQDN."
  value       = azurerm_postgresql_flexible_server.app.fqdn
}

output "database_name" {
  description = "Application database name."
  value       = azurerm_postgresql_flexible_server_database.app.name
}

output "server_id" {
  description = "PostgreSQL Flexible Server resource id."
  value       = azurerm_postgresql_flexible_server.app.id
}

output "admin_database_url" {
  description = "Administrative database URL used only by the migration job to provision runtime roles."
  value       = "postgresql://${local.admin_user}:${urlencode(random_password.postgres_admin.result)}@${azurerm_postgresql_flexible_server.app.fqdn}:5432/${azurerm_postgresql_flexible_server_database.app.name}?${local.connection_options}"
  sensitive   = true
}

output "app_database_url" {
  description = "Application runtime database URL."
  value       = "postgresql://${local.app_user}:${urlencode(random_password.app.result)}@${azurerm_postgresql_flexible_server.app.fqdn}:5432/${azurerm_postgresql_flexible_server_database.app.name}?${local.connection_options}"
  sensitive   = true
}

output "worker_database_url" {
  description = "Worker runtime database URL."
  value       = "postgresql://${local.worker_user}:${urlencode(random_password.worker.result)}@${azurerm_postgresql_flexible_server.app.fqdn}:5432/${azurerm_postgresql_flexible_server_database.app.name}?${local.connection_options}"
  sensitive   = true
}

output "migration_database_url" {
  description = "Migration runtime database URL."
  value       = "postgresql://${local.migration_user}:${urlencode(random_password.migration.result)}@${azurerm_postgresql_flexible_server.app.fqdn}:5432/${azurerm_postgresql_flexible_server_database.app.name}?${local.connection_options}"
  sensitive   = true
}

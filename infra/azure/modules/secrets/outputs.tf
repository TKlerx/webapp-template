output "key_vault_id" {
  description = "Key Vault resource id."
  value       = azurerm_key_vault.environment.id
}

output "key_vault_uri" {
  description = "Key Vault URI."
  value       = azurerm_key_vault.environment.vault_uri
}

output "admin_database_url_secret_id" {
  description = "Versionless Key Vault secret id for the admin database URL."
  value       = azurerm_key_vault_secret.runtime["admin-database-url"].versionless_id
}

output "app_database_url_secret_id" {
  description = "Versionless Key Vault secret id for the app database URL."
  value       = azurerm_key_vault_secret.runtime["app-database-url"].versionless_id
}

output "worker_database_url_secret_id" {
  description = "Versionless Key Vault secret id for the worker database URL."
  value       = azurerm_key_vault_secret.runtime["worker-database-url"].versionless_id
}

output "migration_database_url_secret_id" {
  description = "Versionless Key Vault secret id for the migration database URL."
  value       = azurerm_key_vault_secret.runtime["migration-database-url"].versionless_id
}

output "better_auth_secret_id" {
  description = "Versionless Key Vault secret id for Better Auth."
  value       = azurerm_key_vault_secret.runtime["betterauth-secret"].versionless_id
}

output "initial_admin_email_secret_id" {
  description = "Versionless Key Vault secret id for the initial admin email."
  value       = azurerm_key_vault_secret.runtime["initial-admin-email"].versionless_id
}

output "initial_admin_password_secret_id" {
  description = "Versionless Key Vault secret id for the initial admin password."
  value       = azurerm_key_vault_secret.runtime["initial-admin-password"].versionless_id
}

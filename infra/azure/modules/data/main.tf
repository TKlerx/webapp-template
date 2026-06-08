resource "random_password" "postgres_admin" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "app" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "worker" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "migration" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

locals {
  server_name        = substr(replace("${var.name_prefix}-${var.name_suffix}-pg", "_", "-"), 0, 63)
  database_name      = replace("${var.name_prefix}-app", "-", "_")
  admin_user         = "pgadmin"
  app_user           = "app_user"
  worker_user        = "worker_user"
  migration_user     = "migration_user"
  storage_mb         = var.postgres_storage_gb * 1024
  connection_options = "sslmode=require"
}

resource "azurerm_postgresql_flexible_server" "app" {
  name                          = local.server_name
  resource_group_name           = var.resource_group_name
  location                      = var.location
  version                       = "16"
  delegated_subnet_id           = var.delegated_subnet_id
  private_dns_zone_id           = var.private_dns_zone_id
  public_network_access_enabled = false
  administrator_login           = local.admin_user
  administrator_password        = random_password.postgres_admin.result
  sku_name                      = var.postgres_sku
  storage_mb                    = local.storage_mb
  zone                          = var.postgres_availability_zone
  backup_retention_days         = 7
  tags                          = var.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = local.database_name
  server_id = azurerm_postgresql_flexible_server.app.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

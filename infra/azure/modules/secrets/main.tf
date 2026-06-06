resource "random_password" "better_auth" {
  length  = 48
  special = false
}

resource "random_password" "initial_admin" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

locals {
  key_vault_name = substr(replace("${var.name_prefix}-${var.name_suffix}-kv", "-", ""), 0, 24)

  secret_values = {
    admin-database-url     = var.admin_database_url
    app-database-url       = var.app_database_url
    worker-database-url    = var.worker_database_url
    migration-database-url = var.migration_database_url
    betterauth-secret      = random_password.better_auth.result
    initial-admin-email    = var.initial_admin_email
    initial-admin-password = random_password.initial_admin.result
  }
}

resource "azurerm_key_vault" "environment" {
  name                          = local.key_vault_name
  resource_group_name           = var.resource_group_name
  location                      = var.location
  tenant_id                     = var.tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  public_network_access_enabled = false
  purge_protection_enabled      = true
  soft_delete_retention_days    = 7
  tags                          = var.tags

  network_acls {
    bypass         = "AzureServices"
    default_action = "Deny"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_role_assignment" "runtime_secret_reader" {
  scope                = azurerm_key_vault.environment.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.runtime_identity_principal_id
}

resource "azurerm_role_assignment" "deployment_secret_writer" {
  scope                = azurerm_key_vault.environment.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = var.deployment_identity_object_id
}

resource "azurerm_key_vault_secret" "runtime" {
  for_each = local.secret_values

  name            = each.key
  value           = each.value
  key_vault_id    = azurerm_key_vault.environment.id
  content_type    = "text/plain"
  expiration_date = var.secret_expiration_date
  tags            = var.tags

  depends_on = [azurerm_role_assignment.deployment_secret_writer]
}

resource "azurerm_private_dns_zone" "key_vault" {
  name                = "privatelink.vaultcore.azure.net"
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "key_vault" {
  name                  = "${var.name_prefix}-kv-dns-link"
  resource_group_name   = var.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.key_vault.name
  virtual_network_id    = var.virtual_network_id
  registration_enabled  = false
  tags                  = var.tags
}

resource "azurerm_private_endpoint" "key_vault" {
  name                = "${var.name_prefix}-kv-pe"
  resource_group_name = var.resource_group_name
  location            = var.location
  subnet_id           = var.private_endpoint_subnet_id
  tags                = var.tags

  private_service_connection {
    name                           = "${var.name_prefix}-kv-psc"
    private_connection_resource_id = azurerm_key_vault.environment.id
    is_manual_connection           = false
    subresource_names              = ["vault"]
  }

  private_dns_zone_group {
    name                 = "key-vault"
    private_dns_zone_ids = [azurerm_private_dns_zone.key_vault.id]
  }
}

resource "azurerm_resource_group" "environment" {
  name     = local.resource_group_name
  location = var.location
  tags     = local.tags
}

module "network" {
  source = "./modules/network"

  name_prefix                          = local.name_prefix
  resource_group_name                  = azurerm_resource_group.environment.name
  location                             = azurerm_resource_group.environment.location
  vnet_address_space                   = var.vnet_address_space
  container_apps_subnet_address_prefix = var.container_apps_subnet_address_prefix
  postgres_subnet_address_prefix       = var.postgres_subnet_address_prefix
  tags                                 = local.tags
}

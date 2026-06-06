locals {
  default_app_base_url = "https://${var.name_prefix}-app.${azurerm_container_app_environment.environment.default_domain}"
  app_base_url         = length(trimspace(var.custom_domain)) > 0 ? "https://${trimspace(var.custom_domain)}" : local.default_app_base_url
  auth_base_url        = "${local.app_base_url}${var.base_path}"
}

resource "azurerm_container_app" "app" {
  name                         = "${var.name_prefix}-app"
  container_app_environment_id = azurerm_container_app_environment.environment.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Multiple"
  workload_profile_name        = "Consumption"
  tags                         = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [var.runtime_identity_id]
  }

  registry {
    server   = var.registry_login_server
    identity = var.runtime_identity_id
  }

  secret {
    name                = "app-database-url"
    key_vault_secret_id = var.app_database_url_secret_id
    identity            = var.runtime_identity_id
  }

  secret {
    name                = "betterauth-secret"
    key_vault_secret_id = var.better_auth_secret_id
    identity            = var.runtime_identity_id
  }

  ingress {
    external_enabled           = true
    target_port                = 3270
    transport                  = "http"
    allow_insecure_connections = false

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.app_min_replicas
    max_replicas = var.app_max_replicas

    container {
      name   = "app"
      image  = var.app_image_ref
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "3270"
      }

      env {
        name  = "BASE_PATH"
        value = var.base_path
      }

      env {
        name  = "AUTH_BASE_URL"
        value = local.auth_base_url
      }

      env {
        name        = "APP_DATABASE_URL"
        secret_name = "app-database-url"
      }

      env {
        name        = "DATABASE_URL"
        secret_name = "app-database-url"
      }

      env {
        name        = "BETTER_AUTH_SECRET"
        secret_name = "betterauth-secret"
      }

      env {
        name  = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        value = var.app_insights_connection_string
      }
    }
  }
}

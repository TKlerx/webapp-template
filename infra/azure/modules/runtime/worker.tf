resource "azurerm_container_app" "worker" {
  name                         = "${var.name_prefix}-worker"
  container_app_environment_id = azurerm_container_app_environment.environment.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
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
    name                = "worker-database-url"
    key_vault_secret_id = var.worker_database_url_secret_id
    identity            = var.runtime_identity_id
  }

  template {
    min_replicas = var.worker_min_replicas
    max_replicas = max(var.worker_min_replicas, 1)

    container {
      name   = "worker"
      image  = var.worker_image_ref
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "BASE_PATH"
        value = var.base_path
      }

      env {
        name        = "WORKER_DATABASE_URL"
        secret_name = "worker-database-url"
      }

      env {
        name        = "DATABASE_URL"
        secret_name = "worker-database-url"
      }

      env {
        name  = "TEAMS_ENABLED"
        value = "false"
      }
    }
  }
}

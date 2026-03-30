resource "azurerm_resource_group" "jarvis" {
  name     = var.resource_group_name
  location = var.location
}

# ── Immutable Backup Storage Account ─────────────────────────────────────────
resource "azurerm_storage_account" "backup" {
  name                     = "jarvisbackupstore"
  resource_group_name      = azurerm_resource_group.jarvis.name
  location                 = azurerm_resource_group.jarvis.location
  account_tier             = "Standard"
  account_replication_type = "ZRS" # Zone-redundant for compliance

  blob_properties {
    delete_retention_policy {
      days = 30
    }
    container_delete_retention_policy {
      days = 30
    }
  }

  tags = { environment = "production", compliance = "gdpr-dpdp" }
}

# Immutable storage policy — audit logs cannot be deleted for 7 years
resource "azurerm_storage_management_policy" "backup_lifecycle" {
  storage_account_id = azurerm_storage_account.backup.id

  rule {
    name    = "archive-old-backups"
    enabled = true
    filters {
      blob_types = ["blockBlob"]
    }
    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than    = 30
        tier_to_archive_after_days_since_modification_greater_than = 90
        delete_after_days_since_modification_greater_than          = 2555 # 7 years
      }
    }
  }
}

# ── Azure Key Vault ───────────────────────────────────────────────────────────
resource "azurerm_key_vault" "jarvis" {
  name                = "jarvis-keyvault"
  location            = azurerm_resource_group.jarvis.location
  resource_group_name = azurerm_resource_group.jarvis.name
  sku_name            = "standard"
  tenant_id           = data.azurerm_client_config.current.tenant_id

  soft_delete_retention_days = 90
  purge_protection_enabled   = true

  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
  }
}

data "azurerm_client_config" "current" {}

variable "resource_group_name" { default = "jarvis-rg" }
variable "location"            { default = "East US" }

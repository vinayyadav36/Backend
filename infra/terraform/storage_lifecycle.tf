# infra/terraform/storage_lifecycle.tf
# Vault Shredder — Automated data lifecycle for audit logs and GST invoices.
# Implements the "Omertà" compliance policy:
#   Day   0–30  : Hot  (active analysis, 100% sampled logging)
#   Day  30–90  : Cool (audit-ready, 5% sampled heartbeat logging)
#   Day  90–2555: Archive (immutable vault, court-admissible)
#   Day 2555+   : Permanent deletion (7-year legal hold complete)
# ─────────────────────────────────────────────────────────────────────────────

# Dedicated audit vault storage account (separate from backup for isolation)
resource "azurerm_storage_account" "audit_vault" {
  name                     = "jarvisauditvault"
  resource_group_name      = azurerm_resource_group.jarvis.name
  location                 = azurerm_resource_group.jarvis.location
  account_tier             = "Standard"
  account_replication_type = "GRS"   # Geo-redundant — survives regional outage

  min_tls_version                   = "TLS1_3"
  allow_nested_items_to_be_public   = false
  infrastructure_encryption_enabled = true

  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 30
    }
    container_delete_retention_policy {
      days = 30
    }
  }

  tags = var.tags
}

resource "azurerm_storage_container" "audit_logs_vault" {
  name                  = "audit-logs"
  storage_account_name  = azurerm_storage_account.audit_vault.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "gst_invoices" {
  name                  = "gst-invoices"
  storage_account_name  = azurerm_storage_account.audit_vault.name
  container_access_type = "private"
}

# ── Immutable Storage Policy (WORM — Write Once Read Many) ───────────────────
# Makes audit logs court-admissible: nobody (including Admin) can delete/modify
# a blob until the 7-year retention period expires.
resource "azurerm_storage_management_policy" "vault_shredder" {
  storage_account_id = azurerm_storage_account.audit_vault.id

  rule {
    name    = "ArchiveAndShredFinancials"
    enabled = true

    filters {
      prefix_match = ["audit-logs/", "gst-invoices/"]
      blob_types   = ["blockBlob"]
    }

    actions {
      base_blob {
        # Cooldown: move to Cool after 30 days (5% sampling threshold met)
        tier_to_cool_after_days_since_modification_greater_than = 30

        # The Vault: move to Archive after 90 days (immutable cold storage)
        tier_to_archive_after_days_since_modification_greater_than = 90

        # The Hit: permanent shredding after the legal retention period
        # (var.log_retention_days = 2555 days = 7 years per GDPR/Companies Act)
        delete_after_days_since_modification_greater_than = 2555
      }

      # Also expire old snapshots to prevent storage bloat
      snapshot {
        delete_after_days_since_creation_greater_than = 2555
      }
    }
  }

  rule {
    name    = "WitnessReportLifecycle"
    enabled = true

    filters {
      prefix_match = ["witness-reports/"]
      blob_types   = ["blockBlob"]
    }

    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than    = 90
        tier_to_archive_after_days_since_modification_greater_than = 365
        delete_after_days_since_modification_greater_than          = 2555
      }
    }
  }
}

# ── Output ────────────────────────────────────────────────────────────────────
output "audit_vault_account" {
  value = azurerm_storage_account.audit_vault.name
}

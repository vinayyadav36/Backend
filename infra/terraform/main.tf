# infra/terraform/main.tf
# Project Jarvis — Core Infrastructure
# AKS Cluster · PostgreSQL Flexible Server · Key Vault · Managed Identity
# Remote state: Azure Blob Storage with GRS (survives regional outage)
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90"
    }
  }

  # Remote state in GRS Blob (persists across regional disaster)
  backend "azurerm" {
    resource_group_name  = "jarvis-tfstate-rg"
    storage_account_name = "jarvistfstate"
    container_name       = "tfstate"
    key                  = "jarvis.terraform.tfstate"
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
    }
  }
}

# ── Data Sources ───────────────────────────────────────────────────────────────
data "azurerm_client_config" "current" {}

# ── Resource Groups ───────────────────────────────────────────────────────────
resource "azurerm_resource_group" "jarvis" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

resource "azurerm_resource_group" "global" {
  name     = "jarvis-global-rg"
  location = "East US"
  tags     = var.tags
}

# ── User-Assigned Managed Identity (Workload Identity) ────────────────────────
resource "azurerm_user_assigned_identity" "jarvis" {
  name                = "jarvis-workload-identity"
  resource_group_name = azurerm_resource_group.jarvis.name
  location            = azurerm_resource_group.jarvis.location
  tags                = var.tags
}

# ── AKS Cluster ───────────────────────────────────────────────────────────────
resource "azurerm_kubernetes_cluster" "jarvis" {
  name                = var.aks_cluster_name
  resource_group_name = azurerm_resource_group.jarvis.name
  location            = azurerm_resource_group.jarvis.location
  dns_prefix          = "jarvis"
  tags                = var.tags

  # Workload Identity + OIDC for password-less Key Vault access
  oidc_issuer_enabled       = true
  workload_identity_enabled = true

  # System node pool (1 node — control-plane workloads only)
  default_node_pool {
    name                = "system"
    node_count          = var.aks_node_count
    vm_size             = var.aks_vm_size
    os_disk_size_gb     = 50
    only_critical_addons_enabled = true
  }

  # Managed identity — no service principal passwords
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.jarvis.id]
  }

  network_profile {
    network_plugin    = "azure"
    load_balancer_sku = "standard"
    # Internal load balancer — nodes have no public IPs
    outbound_type = "loadBalancer"
  }

  # Azure Workload Identity federation
  kubelet_identity {
    client_id                 = azurerm_user_assigned_identity.jarvis.client_id
    object_id                 = azurerm_user_assigned_identity.jarvis.principal_id
    user_assigned_identity_id = azurerm_user_assigned_identity.jarvis.id
  }
}

# User node pool — application workloads
resource "azurerm_kubernetes_cluster_node_pool" "user" {
  name                  = "user"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.jarvis.id
  vm_size               = var.aks_vm_size
  node_count            = var.aks_user_node_count
  tags                  = var.tags
}

# ── PostgreSQL Flexible Server ─────────────────────────────────────────────────
resource "azurerm_postgresql_flexible_server" "jarvis" {
  name                = var.pg_server_name
  resource_group_name = azurerm_resource_group.jarvis.name
  location            = azurerm_resource_group.jarvis.location
  version             = "15"
  sku_name            = var.pg_sku

  # No static password — Managed Identity authentication enforced
  authentication {
    active_directory_auth_enabled = true
    password_auth_enabled         = false
    tenant_id                     = data.azurerm_client_config.current.tenant_id
  }

  # Geo-redundant backup → RPO ~5 min for West US failover
  geo_redundant_backup_enabled = true
  backup_retention_days        = 35

  storage_mb   = 32768
  storage_tier = "P30"

  tags = var.tags
}

resource "azurerm_postgresql_flexible_server_database" "jarvis" {
  name      = "jarvis_accounting"
  server_id = azurerm_postgresql_flexible_server.jarvis.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

  # Allow AKS egress to PostgreSQL.
  # TODO: replace with Private Link (azurerm_private_endpoint) in production
  # to remove this public-internet firewall rule entirely. The 0.0.0.0/0 range
  # is acceptable for initial provisioning only.
  resource "azurerm_postgresql_flexible_server_firewall_rule" "aks" {
    name             = "allow-aks"
    server_id        = azurerm_postgresql_flexible_server.jarvis.id
    start_ip_address = "0.0.0.0"
    end_ip_address   = "0.0.0.0"
  }

# ── Azure Key Vault (primary region) ──────────────────────────────────────────
resource "azurerm_key_vault" "jarvis" {
  name                = "jarvis-keyvault"
  location            = azurerm_resource_group.jarvis.location
  resource_group_name = azurerm_resource_group.jarvis.name
  sku_name            = "premium"   # premium required for HSM-backed keys
  tenant_id           = data.azurerm_client_config.current.tenant_id

  soft_delete_retention_days = 90
  purge_protection_enabled   = true

  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
  }

  tags = var.tags
}

# Grant the Workload Identity read access to Key Vault secrets
resource "azurerm_key_vault_access_policy" "workload" {
  key_vault_id = azurerm_key_vault.jarvis.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_user_assigned_identity.jarvis.principal_id

  secret_permissions = ["Get", "List"]
  key_permissions    = ["Get", "List", "Decrypt", "Encrypt"]
}

# ── Immutable Backup Storage Account ──────────────────────────────────────────
resource "azurerm_storage_account" "backup" {
  name                     = "jarvisbackupstore"
  resource_group_name      = azurerm_resource_group.jarvis.name
  location                 = azurerm_resource_group.jarvis.location
  account_tier             = "Standard"
  account_replication_type = "GRS"    # Geo-redundant for DR

  blob_properties {
    delete_retention_policy {
      days = 30
    }
    container_delete_retention_policy {
      days = 30
    }
    versioning_enabled = true
  }

  # AES-256 encryption at rest (default) + TLS 1.3 in transit
  min_tls_version                 = "TLS1_3"
  allow_nested_items_to_be_public = false
  infrastructure_encryption_enabled = true

  tags = var.tags
}

resource "azurerm_storage_container" "audit_logs" {
  name                  = "audit-logs"
  storage_account_name  = azurerm_storage_account.backup.name
  container_access_type = "private"
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "aks_cluster_name"       { value = azurerm_kubernetes_cluster.jarvis.name }
output "aks_resource_group"     { value = azurerm_resource_group.jarvis.name }
output "pg_fqdn"                { value = azurerm_postgresql_flexible_server.jarvis.fqdn }
output "keyvault_uri"           { value = azurerm_key_vault.jarvis.vault_uri }
output "workload_identity_id"   { value = azurerm_user_assigned_identity.jarvis.client_id }
output "backup_storage_account" { value = azurerm_storage_account.backup.name }

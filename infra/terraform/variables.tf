# infra/terraform/variables.tf
# ── Region variables ──────────────────────────────────────────────────────────
variable "resource_group_name" {
  description = "Primary Azure Resource Group"
  default     = "jarvis-rg"
}

variable "location" {
  description = "Primary Azure region"
  default     = "East US"
}

variable "secondary_location" {
  description = "Secondary / failover Azure region"
  default     = "West US"
}

variable "secondary_resource_group_name" {
  description = "Secondary Azure Resource Group (failover stamp)"
  default     = "jarvis-rg-secondary"
}

# ── AKS ───────────────────────────────────────────────────────────────────────
variable "aks_cluster_name" {
  description = "AKS cluster name"
  default     = "jarvis-aks"
}

variable "aks_node_count" {
  description = "System node pool count"
  default     = 1
}

variable "aks_user_node_count" {
  description = "User node pool count"
  default     = 2
}

variable "aks_vm_size" {
  default = "Standard_D2s_v3"
}

# ── PostgreSQL ────────────────────────────────────────────────────────────────
variable "pg_server_name" {
  default = "jarvis-postgres"
}

variable "pg_admin_login" {
  default = "jarvisadmin"
}

variable "pg_sku" {
  default = "GP_Standard_D2s_v3"
}

# ── Front Door (failover) ─────────────────────────────────────────────────────
variable "primary_aks_ingress_url" {
  description = "FQDN of the primary AKS ingress controller"
  default     = ""
}

variable "secondary_aks_ingress_url" {
  description = "FQDN of the secondary AKS ingress controller"
  default     = ""
}

# ── Tagging ───────────────────────────────────────────────────────────────────
variable "log_retention_days" {
  description = "Legal hold period in days (7 years = 2555 days). GDPR / Companies Act 2013 requirement."
  default     = 2555
}
  type = map(string)
  default = {
    environment = "production"
    project     = "jarvis"
    compliance  = "gdpr-dpdp"
  }
}

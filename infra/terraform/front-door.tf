# infra/terraform/front-door.tf
# Azure Front Door — Global Traffic Manager for Active-Passive Failover
# Primary: East US AKS   |   Secondary: West US AKS
# Health probe → /health on NestJS Gateway (HEAD request, 30-second interval)
# ─────────────────────────────────────────────────────────────────────────────

# ── Global Front Door Profile (Premium — required for Private Link) ────────────
resource "azurerm_cdn_frontdoor_profile" "jarvis_global" {
  name                = "jarvis-global-fd"
  resource_group_name = azurerm_resource_group.global.name
  sku_name            = "Premium_AzureFrontDoor"
  tags                = var.tags
}

# ── Origin Group ──────────────────────────────────────────────────────────────
resource "azurerm_cdn_frontdoor_origin_group" "aks_origins" {
  name                     = "jarvis-aks-origins"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.jarvis_global.id
  session_affinity_enabled = false

  health_probe {
    interval_in_seconds = 30
    path                = "/health"
    protocol            = "Https"
    request_type        = "HEAD"
  }

  load_balancing {
    additional_latency_in_milliseconds = 50
    sample_size                        = 4
    successful_samples_required        = 3
  }
}

# ── Primary Origin: East US ───────────────────────────────────────────────────
resource "azurerm_cdn_frontdoor_origin" "primary_region" {
  name                          = "primary-east-us"
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.aks_origins.id
  enabled                       = true
  certificate_name_check_enabled = true
  host_name                     = var.primary_aks_ingress_url
  priority                      = 1    # Preferred
  weight                        = 100
  origin_host_header            = var.primary_aks_ingress_url
  https_port                    = 443
  http_port                     = 80
}

# ── Secondary Origin: West US (failover) ──────────────────────────────────────
resource "azurerm_cdn_frontdoor_origin" "secondary_region" {
  name                          = "secondary-west-us"
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.aks_origins.id
  enabled                       = true
  certificate_name_check_enabled = true
  host_name                     = var.secondary_aks_ingress_url
  priority                      = 2    # Failover
  weight                        = 100
  origin_host_header            = var.secondary_aks_ingress_url
  https_port                    = 443
  http_port                     = 80
}

# ── Route — forward all traffic through Front Door ────────────────────────────
resource "azurerm_cdn_frontdoor_endpoint" "jarvis" {
  name                     = "jarvis-api"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.jarvis_global.id
  tags                     = var.tags
}

resource "azurerm_cdn_frontdoor_route" "default" {
  name                          = "default-route"
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.jarvis.id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.aks_origins.id
  cdn_frontdoor_origin_ids      = [
    azurerm_cdn_frontdoor_origin.primary_region.id,
    azurerm_cdn_frontdoor_origin.secondary_region.id,
  ]

  forwarding_protocol    = "HttpsOnly"
  https_redirect_enabled = true
  patterns_to_match      = ["/*"]
  supported_protocols    = ["Http", "Https"]
  link_to_default_domain = true
}

# ── WAF Policy — global IP blocklist ─────────────────────────────────────────
resource "azurerm_cdn_frontdoor_firewall_policy" "jarvis_waf" {
  name                = "jarvisWafPolicy"
  resource_group_name = azurerm_resource_group.global.name
  sku_name            = azurerm_cdn_frontdoor_profile.jarvis_global.sku_name
  enabled             = true
  mode                = "Prevention"

  # Bot protection (Microsoft-managed ruleset)
  managed_rule {
    type    = "Microsoft_BotManagerRuleSet"
    version = "1.0"
    action  = "Block"
  }

  tags = var.tags
}

resource "azurerm_cdn_frontdoor_security_policy" "waf" {
  name                     = "jarvis-waf-security"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.jarvis_global.id

  security_policies {
    firewall {
      cdn_frontdoor_firewall_policy_id = azurerm_cdn_frontdoor_firewall_policy.jarvis_waf.id
      association {
        patterns_to_match = ["/*"]
        domain {
          cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.jarvis.id
        }
      }
    }
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "front_door_endpoint_hostname" {
  value = azurerm_cdn_frontdoor_endpoint.jarvis.host_name
}
output "waf_policy_id" {
  value = azurerm_cdn_frontdoor_firewall_policy.jarvis_waf.id
}

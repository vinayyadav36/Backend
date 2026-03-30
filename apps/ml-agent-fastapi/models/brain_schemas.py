# apps/ml-agent-fastapi/models/brain_schemas.py
"""Pydantic v2 request/response schemas for all four brain APIs + super-agent."""
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


# ── Shared ────────────────────────────────────────────────────────────────────

class TimeSeriesPoint(BaseModel):
    ds: str          # ISO date "YYYY-MM-DD"
    y: float


# ── Finance Brain ─────────────────────────────────────────────────────────────

class CashFlowRequest(BaseModel):
    history: List[TimeSeriesPoint]
    horizon_days: int = 30
    scenario: str = "base"   # base | optimistic | pessimistic


class ReconcileRequest(BaseModel):
    transactions: List[Dict[str, Any]]
    invoices: List[Dict[str, Any]]


class VarianceRequest(BaseModel):
    budget: List[Dict[str, Any]]   # [{"category": str, "amount": float}]
    actual: List[Dict[str, Any]]
    threshold_pct: float = 10.0


# ── Marketing Brain ───────────────────────────────────────────────────────────

class FunnelRequest(BaseModel):
    leads: List[Dict[str, Any]]


class CACLTVRequest(BaseModel):
    total_marketing_spend: float
    new_customers_acquired: int
    avg_monthly_revenue_per_customer: float
    avg_customer_lifespan_months: float = 12
    monthly_churn_rate_pct: float = 5.0


class CampaignForecastRequest(BaseModel):
    name: str
    channel: str
    budget: float
    duration_days: int = 30
    target_segment_size: int = 1000
    historical_conversion_rate_pct: float = 2.5
    avg_deal_value: float = 5000


class SentimentRequest(BaseModel):
    texts: List[str]


class SegmentRequest(BaseModel):
    customers: List[Dict[str, Any]]
    n_clusters: int = 3


class BudgetReallocationRequest(BaseModel):
    channels: List[Dict[str, Any]]  # [{"name": str, "spend": float, "revenue": float}]


# ── Sales Brain ───────────────────────────────────────────────────────────────

class LeadScoreRequest(BaseModel):
    leads: List[Dict[str, Any]]


class PipelineRequest(BaseModel):
    deals: List[Dict[str, Any]]


class PricingRequest(BaseModel):
    products: List[Dict[str, Any]]


class ContractRequest(BaseModel):
    buyer_name: str
    seller_name: str
    value: float
    currency: str = "INR"
    scope: Optional[str] = None
    payment_terms_days: int = 30


# ── Operations Brain ──────────────────────────────────────────────────────────

class InventoryRequest(BaseModel):
    inventory: List[Dict[str, Any]]
    sales_pipeline_signal: float = 1.0
    cash_flow_signal: float = 1.0


class VendorRequest(BaseModel):
    vendors: List[Dict[str, Any]]


class SLARequest(BaseModel):
    tickets: List[Dict[str, Any]]


class RestockRequest(BaseModel):
    restock_items: List[Dict[str, Any]]


# ── Enterprise Super-Agent ────────────────────────────────────────────────────

class FinancePayload(BaseModel):
    history: Optional[List[TimeSeriesPoint]] = None
    horizon_days: int = 30
    scenario: str = "base"
    budget: Optional[List[Dict[str, Any]]] = None
    actual: Optional[List[Dict[str, Any]]] = None


class MarketingPayload(BaseModel):
    leads: Optional[List[Dict[str, Any]]] = None
    cac_ltv_data: Optional[Dict[str, Any]] = None
    feedback_texts: Optional[List[str]] = None
    channels: Optional[List[Dict[str, Any]]] = None


class SalesPayload(BaseModel):
    deals: Optional[List[Dict[str, Any]]] = None
    leads: Optional[List[Dict[str, Any]]] = None


class OpsPayload(BaseModel):
    inventory: Optional[List[Dict[str, Any]]] = None
    vendors: Optional[List[Dict[str, Any]]] = None
    tickets: Optional[List[Dict[str, Any]]] = None


class DashboardRequest(BaseModel):
    finance: Optional[FinancePayload] = None
    marketing: Optional[MarketingPayload] = None
    sales: Optional[SalesPayload] = None
    operations: Optional[OpsPayload] = None


class ScenarioRequest(BaseModel):
    base_payload: DashboardRequest
    scenarios: List[str] = ["base", "optimistic", "pessimistic"]

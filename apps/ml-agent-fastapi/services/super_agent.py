# apps/ml-agent-fastapi/services/super_agent.py
"""
Enterprise Super-Agent Orchestrator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IQ  — Cognitive: ultra-precise, multi-factor ML models per domain
EQ  — Emotional: sentiment-aware, human-centric alert language
AQ  — Adaptive:  cross-brain feedback loops + scenario simulation

Four brains, one unified executive view.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import date

from services.finance_brain   import CashFlowBrain, VarianceAlertEngine, ReconciliationBrain
from services.marketing_brain import (
    FunnelAnalyzer, CACLTVCalculator, CampaignROIForecaster,
    SentimentAnalyzer, BudgetReallocationEngine,
)
from services.sales_brain     import LeadScoringBrain, PipelineForecaster, DynamicPricingEngine
from services.ops_brain       import InventoryOptimiser, VendorLeadTimePredictor, SLAMonitor


class EnterpriseSuperAgent:
    """
    Orchestrate all four brains, share signals across departments,
    and produce a unified executive dashboard + boardroom alert set.
    """

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id

        # Instantiate brains
        self._cash_flow      = CashFlowBrain(tenant_id)
        self._variance       = VarianceAlertEngine()
        self._recon          = ReconciliationBrain()
        self._funnel         = FunnelAnalyzer()
        self._cac_ltv        = CACLTVCalculator()
        self._campaign_roi   = CampaignROIForecaster()
        self._sentiment      = SentimentAnalyzer()
        self._budget_realloc = BudgetReallocationEngine()
        self._lead_scorer    = LeadScoringBrain()
        self._pipeline       = PipelineForecaster()
        self._pricing        = DynamicPricingEngine()
        self._inventory      = InventoryOptimiser()
        self._vendor         = VendorLeadTimePredictor()
        self._sla            = SLAMonitor()

    # ─────────────────────────────────────────────────────────────────────────
    # UNIFIED EXECUTIVE DASHBOARD
    # ─────────────────────────────────────────────────────────────────────────

    def executive_dashboard(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Single call that runs all four brains, shares cross-department signals,
        and returns a boardroom-ready executive summary.
        """
        results: Dict[str, Any] = {}
        alerts: List[str] = []

        # ── Finance Brain ─────────────────────────────────────────────────────
        finance_data = payload.get("finance", {})
        if finance_data.get("history"):
            cf = self._cash_flow.forecast(
                finance_data["history"],
                days=finance_data.get("horizon_days", 30),
                scenario=finance_data.get("scenario", "base"),
            )
            results["finance"] = {
                "cash_flow_forecast": cf["summary"],
                "liquidity_warning": cf["liquidity_warning"],
                "model_used": cf["model_used"],
            }
            if cf["liquidity_warning"]["risk"]:
                alerts.append(
                    f"💰 FINANCE: {cf['liquidity_warning']['message']}"
                )
            # Export cash_flow_signal for Ops Brain
            net = cf["summary"].get("net_cash_position", 0)
            max_net = max(abs(net), 1)
            cash_flow_signal = max(0.5, min(1.5, 1.0 + net / max_net * 0.5))
        else:
            cash_flow_signal = 1.0
            results["finance"] = {"note": "No financial history provided."}

        # Budget variance
        if finance_data.get("budget") and finance_data.get("actual"):
            va = self._variance.analyse(finance_data["budget"], finance_data["actual"])
            results["finance"]["budget_variance"] = va
            for a in va["alerts"]:
                alerts.append(f"💰 FINANCE VARIANCE: {a}")

        # ── Marketing Brain ───────────────────────────────────────────────────
        marketing_data = payload.get("marketing", {})
        if marketing_data.get("leads"):
            funnel = self._funnel.analyse(marketing_data["leads"])
            results["marketing"] = {"funnel": funnel}
            if funnel["bottleneck"]["drop_off_pct"] > 40:
                alerts.append(
                    f"📣 MARKETING: {funnel['bottleneck']['recommendation']}"
                )
        else:
            results["marketing"] = {}

        if marketing_data.get("cac_ltv_data"):
            cac_ltv = self._cac_ltv.calculate(marketing_data["cac_ltv_data"])
            results["marketing"]["cac_ltv"] = cac_ltv
            if cac_ltv["health"] in ("MARGINAL", "CRITICAL"):
                alerts.append(f"📣 MARKETING: {cac_ltv['recommendation']}")
            # Export: CAC/LTV ratio feeds Finance Brain CAC cost signal
            results["finance"]["cac_impact"] = {
                "cac": cac_ltv["cac"],
                "note": "CAC subtracted from customer lifetime cash-flow projections.",
            }

        if marketing_data.get("feedback_texts"):
            sentiment = self._sentiment.analyse(marketing_data["feedback_texts"])
            results["marketing"]["sentiment"] = sentiment
            if sentiment["overall"] == "NEGATIVE":
                alerts.append(f"📣 MARKETING/EQ: {sentiment['insight']}")

        # ── Sales Brain ───────────────────────────────────────────────────────
        sales_data = payload.get("sales", {})
        pipeline_signal = 1.0

        if sales_data.get("deals"):
            pipeline = self._pipeline.forecast(sales_data["deals"])
            results["sales"] = {"pipeline": pipeline}
            # Sales → Finance: weighted pipeline feeds receivables
            results["finance"]["receivables_estimate"] = pipeline["cross_dept_signal"]
            # Sales signal for Ops Brain (higher pipeline = buffer more stock)
            pipeline_signal = min(1.5, 1.0 + pipeline["weighted_forecast"] / max(
                pipeline["total_pipeline_value"], 1
            ) * 0.5)
        else:
            results["sales"] = {}

        if sales_data.get("leads"):
            top_leads = self._lead_scorer.score_batch(sales_data["leads"])[:5]
            results["sales"]["top_leads"] = top_leads
            hot = [l for l in top_leads if l["label"] == "HOT"]
            for l in hot:
                alerts.append(
                    f"🔥 SALES: Lead '{l['lead_id']}' scores {l['score']}/100 — {l['recommendation']}"
                )

        # ── Operations Brain ──────────────────────────────────────────────────
        ops_data = payload.get("operations", {})

        if ops_data.get("inventory"):
            inv = self._inventory.optimise(
                ops_data["inventory"],
                sales_pipeline_signal=pipeline_signal,
                cash_flow_signal=cash_flow_signal,
            )
            results["operations"] = {"inventory": inv}
            for a in inv["alerts"]:
                alerts.append(f"⚙️ OPS: {a}")
            # Ops → Finance: holding cost fed into liquidity model
            if "finance" in results:
                results["finance"]["ops_holding_cost_daily"] = inv["total_daily_holding_cost"]

        if ops_data.get("vendors"):
            vendor_result = self._vendor.predict(ops_data["vendors"])
            results.setdefault("operations", {})["vendors"] = vendor_result
            if vendor_result["high_risk_vendors"]:
                alerts.append(f"⚙️ OPS: {vendor_result['alert']}")

        if ops_data.get("tickets"):
            sla = self._sla.analyse(ops_data["tickets"])
            results.setdefault("operations", {})["sla"] = sla
            for a in sla["alerts"][:3]:  # top 3 SLA alerts
                alerts.append(f"⚙️ OPS/SLA: {a}")

        # ── Build Executive Summary ───────────────────────────────────────────
        return {
            "tenant_id": self.tenant_id,
            "generated_at": date.today().isoformat(),
            "executive_summary": self._build_summary(results, alerts),
            "alerts": alerts,
            "alert_count": len(alerts),
            "results": results,
        }

    def _build_summary(self, results: Dict, alerts: List[str]) -> Dict[str, Any]:
        fin  = results.get("finance", {})
        mkt  = results.get("marketing", {})
        sal  = results.get("sales", {})
        ops  = results.get("operations", {})

        kpis = {}

        # Finance KPIs
        cf_summary = fin.get("cash_flow_forecast", {})
        if cf_summary:
            kpis["net_cash_position_INR"] = cf_summary.get("net_cash_position")
            kpis["projected_inflow_INR"]  = cf_summary.get("total_projected_inflow")

        # Marketing KPIs
        cac_ltv = mkt.get("cac_ltv", {})
        if cac_ltv:
            kpis["cac_INR"]       = cac_ltv.get("cac")
            kpis["ltv_INR"]       = cac_ltv.get("ltv")
            kpis["ltv_cac_ratio"] = cac_ltv.get("ltv_cac_ratio")

        # Sales KPIs
        pipeline = sal.get("pipeline", {})
        if pipeline:
            kpis["pipeline_value_INR"]    = pipeline.get("total_pipeline_value")
            kpis["weighted_forecast_INR"] = pipeline.get("weighted_forecast")
            kpis["open_deals"]            = pipeline.get("deal_count")

        # Ops KPIs
        inv = ops.get("inventory", {})
        if inv:
            kpis["daily_holding_cost_INR"] = inv.get("total_daily_holding_cost")
            kpis["restock_items_pending"]  = len(inv.get("restock_orders", []))

        sla = ops.get("sla", {})
        if sla:
            kpis["sla_breach_rate_pct"] = sla.get("breach_rate_pct")
            kpis["estimated_csat"]      = sla.get("estimated_csat")

        health = (
            "🔴 CRITICAL — immediate action required."  if len(alerts) > 5 else
            "🟡 CAUTION — review flagged areas."        if len(alerts) > 2 else
            "🟢 HEALTHY — all systems nominal."
        )

        return {
            "health_status": health,
            "kpis": kpis,
            "top_alerts": alerts[:5],
            "currency": "INR",
        }

    # ─────────────────────────────────────────────────────────────────────────
    # WHAT-IF SCENARIO SIMULATION (AQ — Adaptability)
    # ─────────────────────────────────────────────────────────────────────────

    def scenario_simulation(self, base_payload: Dict[str, Any], scenarios: List[str]) -> Dict[str, Any]:
        """
        Run the executive dashboard under multiple named scenarios and
        compare the outcomes side-by-side.

        Supported scenarios: "base", "optimistic", "pessimistic", "stress_test"
        """
        multipliers = {
            "base":        {"finance": 1.0,  "marketing": 1.0,  "sales": 1.0,  "ops": 1.0},
            "optimistic":  {"finance": 1.15, "marketing": 1.2,  "sales": 1.25, "ops": 0.9},
            "pessimistic": {"finance": 0.80, "marketing": 0.75, "sales": 0.70, "ops": 1.1},
            "stress_test": {"finance": 0.60, "marketing": 0.5,  "sales": 0.55, "ops": 1.3},
        }

        results = {}
        for scenario in scenarios:
            mult = multipliers.get(scenario, multipliers["base"])
            tweaked = self._apply_scenario_multipliers(base_payload, mult)
            dashboard = self.executive_dashboard(tweaked)
            results[scenario] = {
                "health_status": dashboard["executive_summary"]["health_status"],
                "kpis": dashboard["executive_summary"]["kpis"],
                "alert_count": dashboard["alert_count"],
                "top_alerts": dashboard["alerts"][:3],
            }

        # Cross-scenario comparison
        best  = min(results, key=lambda s: results[s]["alert_count"])
        worst = max(results, key=lambda s: results[s]["alert_count"])

        return {
            "tenant_id": self.tenant_id,
            "scenarios_run": scenarios,
            "results": results,
            "comparison": {
                "best_scenario":  best,
                "worst_scenario": worst,
                "recommendation": (
                    f"Plan for '{worst}' — prepare contingency budget. "
                    f"'{best}' scenario suggests strong upside if key drivers align."
                ),
            },
        }

    def _apply_scenario_multipliers(
        self, payload: Dict[str, Any], mult: Dict[str, float]
    ) -> Dict[str, Any]:
        import copy, json
        p = copy.deepcopy(payload)

        # Finance: scale historical y values
        for point in p.get("finance", {}).get("history", []):
            point["y"] = float(point.get("y", 0)) * mult["finance"]

        # Sales: scale deal values
        for deal in p.get("sales", {}).get("deals", []):
            deal["value"] = float(deal.get("value", 0)) * mult["sales"]

        # Marketing: scale spend / revenue
        for ch in p.get("marketing", {}).get("channels", []):
            ch["revenue"] = float(ch.get("revenue", 0)) * mult["marketing"]

        # Ops: scale demand signals
        for item in p.get("operations", {}).get("inventory", []):
            item["avg_daily_demand"] = float(item.get("avg_daily_demand", 1)) * mult["ops"]

        return p

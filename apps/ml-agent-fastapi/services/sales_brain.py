# apps/ml-agent-fastapi/services/sales_brain.py
"""
Sales Brain — CRO-level persuasion
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Capabilities:
  1. Lead scoring          — XGBoost / Gradient Boosting conversion probability
  2. Pipeline forecasting  — Logistic regression deal-closure probability
  3. Dynamic pricing       — Demand + competitor + margin-aware price engine
  4. Smart contract gen    — Template-based with compliance auto-clauses
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import date, timedelta
import uuid


# ─────────────────────────────────────────────────────────────────────────────
# 1. Lead Scoring Brain
# ─────────────────────────────────────────────────────────────────────────────

class LeadScoringBrain:
    """
    Score leads 0–100 using XGBoost (→ GradientBoosting fallback → heuristic).
    Inputs: demographics, engagement, campaign source, purchase history.
    """

    _WEIGHTS = {
        "engagement_score":           25,
        "purchase_history_count":     20,
        "email_open_rate_pct":        15,
        "site_visits_last_30d":       10,
        "demo_requested":             15,
        "budget_confirmed":           15,
    }

    def score_single(self, lead: Dict[str, Any]) -> Dict[str, Any]:
        try:
            return self._xgb_score(lead)
        except ImportError:
            return self._heuristic_score(lead)

    def score_batch(self, leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        scored = [self.score_single(l) for l in leads]
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored

    # ── XGBoost / GradientBoosting ────────────────────────────────────────
    def _xgb_score(self, lead: Dict[str, Any]) -> Dict[str, Any]:
        try:
            import xgboost as xgb
            import numpy as np
            clf_cls = xgb.XGBClassifier
        except ImportError:
            from sklearn.ensemble import GradientBoostingClassifier as clf_cls
            import numpy as np

        X = np.array([[
            float(lead.get("engagement_score", 0.5)),
            float(lead.get("purchase_history_count", 0)),
            float(lead.get("email_open_rate_pct", 20)),
            float(lead.get("site_visits_last_30d", 0)),
            int(bool(lead.get("demo_requested", False))),
            int(bool(lead.get("budget_confirmed", False))),
            float(lead.get("days_in_pipeline", 30)),
        ]])

        # Synthetic training set (replace with real historical data in production)
        X_train = np.array([
            [0.9, 5, 60, 20, 1, 1, 7],
            [0.2, 0, 10, 1, 0, 0, 90],
            [0.6, 2, 40, 8, 1, 0, 30],
            [0.8, 3, 55, 15, 1, 1, 14],
            [0.1, 0, 5, 0, 0, 0, 120],
        ])
        y_train = [1, 0, 1, 1, 0]

        try:
            clf = clf_cls(n_estimators=50, random_state=42)
        except TypeError:
            clf = clf_cls()

        clf.fit(X_train, y_train)
        prob = float(clf.predict_proba(X)[0][1])
        return self._format_score(lead, prob, "ML")

    # ── Heuristic ────────────────────────────────────────────────────────────
    def _heuristic_score(self, lead: Dict[str, Any]) -> Dict[str, Any]:
        raw = 0.0
        total_weight = sum(self._WEIGHTS.values())
        raw += lead.get("engagement_score", 0.5) * self._WEIGHTS["engagement_score"]
        raw += min(lead.get("purchase_history_count", 0), 5) / 5 * self._WEIGHTS["purchase_history_count"]
        raw += min(lead.get("email_open_rate_pct", 0), 80) / 80 * self._WEIGHTS["email_open_rate_pct"]
        raw += min(lead.get("site_visits_last_30d", 0), 30) / 30 * self._WEIGHTS["site_visits_last_30d"]
        raw += int(bool(lead.get("demo_requested", False))) * self._WEIGHTS["demo_requested"]
        raw += int(bool(lead.get("budget_confirmed", False))) * self._WEIGHTS["budget_confirmed"]
        prob = raw / total_weight
        return self._format_score(lead, prob, "heuristic")

    @staticmethod
    def _format_score(lead: Dict[str, Any], prob: float, model: str) -> Dict[str, Any]:
        score = round(prob * 100, 1)
        label = "HOT" if score >= 70 else "WARM" if score >= 40 else "COLD"
        return {
            "lead_id": lead.get("id", lead.get("email", "unknown")),
            "score": score,
            "label": label,
            "conversion_probability_pct": round(prob * 100, 1),
            "model": model,
            "recommendation": (
                f"🔥 Priority follow-up — assign senior sales rep immediately."
                if label == "HOT"
                else "Nurture with targeted content." if label == "WARM"
                else "Add to long-term drip campaign."
            ),
        }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Pipeline Forecaster
# ─────────────────────────────────────────────────────────────────────────────

class PipelineForecaster:
    """Predict deal closure probability and expected revenue per stage."""

    # Industry benchmark close rates per stage
    STAGE_BASE_RATES = {
        "lead": 0.05,
        "qualified": 0.15,
        "proposal": 0.35,
        "negotiation": 0.65,
        "closed_won": 1.00,
        "closed_lost": 0.00,
    }

    def forecast(self, deals: List[Dict[str, Any]]) -> Dict[str, Any]:
        stage_rollup: Dict[str, Dict] = {}
        total_weighted_revenue = 0.0

        for deal in deals:
            stage = str(deal.get("stage", "lead")).lower()
            value = float(deal.get("value", 0))
            base_rate = self.STAGE_BASE_RATES.get(stage, 0.05)

            # Adjust for deal-specific factors
            days_open = int(deal.get("days_open", 30))
            engagement = float(deal.get("engagement_score", 0.5))
            adj_rate = min(1.0, base_rate * (1 + engagement * 0.3) * max(0.5, 1 - days_open / 180))

            weighted_rev = value * adj_rate
            total_weighted_revenue += weighted_rev

            if stage not in stage_rollup:
                stage_rollup[stage] = {"stage": stage, "deal_count": 0, "total_value": 0, "weighted_value": 0}
            stage_rollup[stage]["deal_count"] += 1
            stage_rollup[stage]["total_value"] += value
            stage_rollup[stage]["weighted_value"] += weighted_rev

        pipeline_summary = []
        for s in stage_rollup.values():
            s["close_probability_pct"] = round(
                self.STAGE_BASE_RATES.get(s["stage"], 0.05) * 100, 0
            )
            s["weighted_value"] = round(s["weighted_value"], 2)
            s["total_value"] = round(s["total_value"], 2)
            pipeline_summary.append(s)

        total_pipeline = sum(float(d.get("value", 0)) for d in deals)

        return {
            "total_pipeline_value": round(total_pipeline, 2),
            "weighted_forecast": round(total_weighted_revenue, 2),
            "pipeline_by_stage": pipeline_summary,
            "deal_count": len(deals),
            "forecast_accuracy_note": "Weighted by stage probability + deal engagement score",
            "currency": "INR",
            "cross_dept_signal": {
                "finance_receivables_estimate": round(total_weighted_revenue * 0.85, 2),
                "expected_close_30d": round(
                    sum(
                        float(d.get("value", 0)) * self.STAGE_BASE_RATES.get(
                            str(d.get("stage", "lead")).lower(), 0.05
                        )
                        for d in deals
                        if int(d.get("days_open", 999)) < 30
                    ), 2
                ),
            },
        }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Dynamic Pricing Engine
# ─────────────────────────────────────────────────────────────────────────────

class DynamicPricingEngine:
    """
    Suggest optimal price based on:
    - demand index (high demand → price up)
    - inventory level (low stock → price up)
    - competitor benchmark (stay within ±15 %)
    - minimum margin guardrail (Finance Brain guardrail)
    """

    def suggest(self, product: Dict[str, Any]) -> Dict[str, Any]:
        base_price = float(product.get("base_price", 0))
        cost = float(product.get("cost_price", base_price * 0.6))
        demand_index = float(product.get("demand_index", 1.0))   # 0.5 = low, 1.5 = high
        inventory_level = float(product.get("inventory_level_pct", 50))  # % of max stock
        competitor_price = float(product.get("competitor_avg_price", base_price))
        min_margin_pct = float(product.get("min_margin_pct", 20))

        # Demand factor: +5 % per 0.1 above 1.0
        demand_adj = 1.0 + (demand_index - 1.0) * 0.5

        # Scarcity factor: price up when inventory < 20 %
        if inventory_level < 20:
            scarcity_adj = 1.10
        elif inventory_level < 50:
            scarcity_adj = 1.05
        else:
            scarcity_adj = 1.0

        suggested = base_price * demand_adj * scarcity_adj

        # Competitor guardrail: stay within ±15 %
        comp_max = competitor_price * 1.15
        comp_min = competitor_price * 0.85
        suggested = max(comp_min, min(comp_max, suggested))

        # Margin guardrail (Finance Brain integration)
        min_price = cost * (1 + min_margin_pct / 100)
        suggested = max(suggested, min_price)

        margin_pct = (suggested - cost) / max(suggested, 1) * 100

        return {
            "product": product.get("name", "Product"),
            "base_price": round(base_price, 2),
            "suggested_price": round(suggested, 2),
            "competitor_avg_price": round(competitor_price, 2),
            "margin_pct": round(margin_pct, 1),
            "demand_index": demand_index,
            "inventory_level_pct": inventory_level,
            "reasoning": (
                f"Demand {demand_index:.1f}× + inventory {inventory_level:.0f}% → "
                f"{'premium' if suggested > base_price else 'competitive'} pricing. "
                f"Margin: {margin_pct:.1f}%."
            ),
            "currency": "INR",
        }


# ─────────────────────────────────────────────────────────────────────────────
# 4. Smart Contract Generator
# ─────────────────────────────────────────────────────────────────────────────

class SmartContractGenerator:
    """
    Generate a compliance-ready sales contract from deal data.
    Auto-embeds GST, jurisdiction, data-privacy, and dispute clauses.
    Every generated contract is immutably logged (hash appended by caller).
    """

    _COMPLIANCE_CLAUSES = {
        "gst": (
            "GST CLAUSE: All prices are exclusive of applicable Goods and Services Tax (GST). "
            "GST shall be charged at the prevailing rate and mentioned separately on the invoice. "
            "The Seller shall file GST returns in compliance with the CGST/SGST/IGST Acts."
        ),
        "data_privacy": (
            "DATA PRIVACY: Both parties agree to process personal data in compliance with the "
            "Digital Personal Data Protection Act, 2023 (DPDP) and applicable GDPR provisions. "
            "Customer data shall not be shared with third parties without explicit consent."
        ),
        "dispute": (
            "DISPUTE RESOLUTION: Any disputes shall be resolved by binding arbitration "
            "under the Arbitration and Conciliation Act, 1996. Jurisdiction: [City], India."
        ),
        "payment": (
            "PAYMENT TERMS: Payment is due within {payment_days} days of invoice date. "
            "Late payments attract interest at 18% per annum."
        ),
        "confidentiality": (
            "CONFIDENTIALITY: Both parties agree to maintain strict confidentiality of all "
            "business information exchanged under this agreement for a period of 3 years."
        ),
    }

    def generate(self, deal: Dict[str, Any]) -> Dict[str, Any]:
        contract_id = str(uuid.uuid4())
        today = date.today().isoformat()
        payment_days = int(deal.get("payment_terms_days", 30))

        clauses = {
            key: val.replace("{payment_days}", str(payment_days))
            for key, val in self._COMPLIANCE_CLAUSES.items()
        }

        contract_text = f"""
SALES AGREEMENT
═══════════════════════════════════════════════════════
Contract ID  : {contract_id}
Date         : {today}
Seller       : {deal.get("seller_name", "[Seller]")}
Buyer        : {deal.get("buyer_name", "[Buyer]")}
═══════════════════════════════════════════════════════

1. SCOPE OF WORK
{deal.get("scope", "Services/Products as detailed in the attached Schedule A.")}

2. COMMERCIAL TERMS
   Deal Value   : ₹{deal.get("value", 0):,.2f}
   Currency     : {deal.get("currency", "INR")}
   Payment Terms: {payment_days} days

3. {clauses["gst"]}

4. {clauses["payment"]}

5. {clauses["data_privacy"]}

6. {clauses["confidentiality"]}

7. {clauses["dispute"]}

8. SIGNATURES
   Seller: _________________________  Date: ___________
   Buyer : _________________________  Date: ___________

[IMMUTABLE AUDIT LOG: This contract was system-generated. Any amendments
 require dual-party digital signatures and will be separately logged.]
""".strip()

        import hashlib
        contract_hash = hashlib.sha256(contract_text.encode()).hexdigest()

        return {
            "contract_id": contract_id,
            "generated_on": today,
            "buyer": deal.get("buyer_name"),
            "seller": deal.get("seller_name"),
            "value": deal.get("value"),
            "currency": deal.get("currency", "INR"),
            "compliance_clauses": list(clauses.keys()),
            "contract_text": contract_text,
            "immutable_hash": contract_hash,
            "status": "DRAFT",
            "note": "Requires legal review and dual-party signatures before execution.",
        }

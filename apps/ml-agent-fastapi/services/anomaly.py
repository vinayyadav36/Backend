# apps/ml-agent-fastapi/services/anomaly.py
"""
Anomaly / Fraud Detection using Isolation Forest.
"""
from typing import List, Dict, Any


class AnomalyDetector:
    def detect(self, data: List[Dict[str, Any]], contamination: float = 0.01) -> List[Dict[str, Any]]:
        """Return only the anomalous records from data."""
        try:
            from sklearn.ensemble import IsolationForest

            amounts = [[float(d.get("amount", 0))] for d in data]
            contamination = max(0.001, min(float(contamination), 0.5))
            preds = IsolationForest(contamination=contamination, random_state=42).fit_predict(amounts)
            return [data[i] for i, p in enumerate(preds) if p == -1]
        except ImportError:
            return []

    def find_matches(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Match bank transactions to invoices by amount proximity."""
        transactions = payload.get("transactions", [])
        invoices = payload.get("invoices", [])
        matched = []
        for txn in transactions:
            for inv in invoices:
                if abs(float(txn.get("amount", 0)) - float(inv.get("total", 0))) < 1.0:
                    matched.append({"transaction": txn, "invoice": inv, "confidence": 0.95})
                    break
        return matched

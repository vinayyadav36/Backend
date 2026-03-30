# apps/ml-agent-fastapi/models/schemas.py
from pydantic import BaseModel
from typing import List, Optional, Any, Dict


class HistoryPoint(BaseModel):
    ds: str    # ISO date string e.g. "2024-01-15"
    y: float   # metric value


class ForecastRequest(BaseModel):
    history_data: List[HistoryPoint]
    days: int = 30


class QueryRequest(BaseModel):
    question: str
    context: Optional[str] = None


class AnomalyRequest(BaseModel):
    data: List[Dict[str, Any]]
    contamination: float = 0.01


class LeadScoreRequest(BaseModel):
    features: Dict[str, Any]


class AgentRequest(BaseModel):
    task: str
    payload: Dict[str, Any] = {}


class ReconcileRequest(BaseModel):
    transactions: List[Dict[str, Any]]
    invoices: List[Dict[str, Any]]

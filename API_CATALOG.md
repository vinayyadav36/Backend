# PROJECT JARVIS — API Catalog

> Base URL (Express legacy): `https://api.example.com/api/v1`  
> Base URL (NestJS Gateway): `https://api.example.com/api/v1` (routed via Ingress)  
> Auth: `Authorization: Bearer <JWT>` + `x-tenant-id: <tenantId>` on all requests

---

## 🔐 Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | JWT login |
| POST | `/auth/register` | User registration |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/forgot-password` | Initiate password reset |

---

## 💰 Finance (Ledger & GST)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/finance/transaction` | Post a double-entry journal entry |
| POST | `/finance/invoice` | Create GST invoice + auto journal entry |
| GET  | `/finance/summary` | Account balances for tenant |
| POST | `/gst/export` | Export invoice as PDF or Excel → Drive |
| POST | `/pdf/invoice` | Stream GST invoice PDF directly |

---

## 📊 Reports & Dashboards

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/reports/finance/overview` | Monthly revenue vs GST liability |
| GET  | `/reports/finance/budget-vs-actual` | Budget vs actual (Power BI ready) |
| POST | `/reports/finance/export` | Export to Excel + Google Drive |
| POST | `/reports/finance/import` | Import budget.xlsx |

---

## 🤖 AI / ML Agent

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/embeddings` | Generate text embeddings |
| POST | `/ai/forecast` | Revenue forecast (Prophet / moving avg) |
| POST | `/ai/anomaly` | Detect anomalous transactions |
| POST | `/ai/lead-score` | Score a lead |
| POST | `/ai/agent` | Run Jarvis knowledge-base Q&A (RAG) |

---

## 💰 Finance Brain (CFO-level precision)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/finance/forecast` | Cash-flow forecast — ARIMA → Prophet → MA, with liquidity warning |
| POST | `/finance/reconcile` | ML reconciliation match → saved to `pending_tasks` (human approval required) |
| POST | `/finance/variance` | Budget vs actual variance alerts (configurable threshold) |

---

## 📣 Marketing Brain (CMO-level creativity)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/marketing/funnel` | Lead → conversion funnel drop-off analysis |
| POST | `/marketing/cac-ltv` | Customer Acquisition Cost vs Lifetime Value |
| POST | `/marketing/forecast` | Campaign ROI prediction before launch |
| POST | `/marketing/sentiment` | NLP sentiment analysis (VADER → TextBlob → keyword) |
| POST | `/marketing/segment` | K-means audience segmentation |
| POST | `/marketing/budget-reallocation` | Shift spend to highest-ROI channels |

---

## 💼 Sales Brain (CRO-level persuasion)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sales/lead-score` | XGBoost lead scoring — HOT/WARM/COLD |
| POST | `/sales/pipeline` | Pipeline deal-closure probability + weighted forecast |
| POST | `/sales/pricing` | Dynamic pricing (demand + inventory + competitor) |
| POST | `/sales/contract` | GST-compliant smart contract generation (SHA-256 logged) |

---

## ⚙️ Operations Brain (COO-level efficiency)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/operations/inventory` | EOQ-based inventory optimisation + cross-dept signals |
| POST | `/operations/vendor-leadtime` | Vendor delivery risk scoring + alternate supplier alerts |
| POST | `/operations/sla` | SLA breach detection + CSAT estimate |
| POST | `/operations/restock` | Trigger restock workflow → saved to `pending_tasks` |

---

## 🌐 Enterprise Super-Agent (IQ + EQ + AQ)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/super-agent/dashboard` | **All four brains** — unified executive KPIs + boardroom alerts |
| POST | `/super-agent/scenario` | **What-if simulation** — base, optimistic, pessimistic, stress_test |

### Dashboard Request Schema
```json
{
  "finance":    { "history": [{"ds":"2024-01-01","y":50000}], "scenario":"base", "budget":[], "actual":[] },
  "marketing":  { "leads": [], "cac_ltv_data": {}, "feedback_texts": [] },
  "sales":      { "deals": [], "leads": [] },
  "operations": { "inventory": [], "vendors": [], "tickets": [] }
}
```

---

## 🔄 Automation (Temporal / Workflows)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/automation/reconcile/start` | Start nightly reconciliation workflow |
| POST | `/automation/reconcile/approve` | Manager approves → commits to ledger |
| POST | `/automation/reconcile/reject` | Manager rejects workflow |
| POST | `/workflows/gst/start` | Start GST filing workflow |
| POST | `/workflows/gst/approve/:id` | Approve GST workflow |
| POST | `/workflows/reconcile/start` | Start reconciliation via Durable Functions |
| POST | `/workflows/invoice/start` | Start invoice dispatch workflow |
| GET  | `/workflows/status/:id` | Get workflow status by instance ID |

---

## 🛠️ Worker Service

| Method | Path | Description |
|--------|------|-------------|
| POST | `/worker/reconcile` | Trigger async bank reconciliation |
| POST | `/worker/email` | Dispatch email via worker |
| POST | `/worker/invoice` | Generate invoice via worker |

---

## 📜 Compliance (GDPR / DPDP)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/compliance/consent` | Record user consent |
| GET  | `/compliance/consent/:userId` | Get all consents (Right to Access) |
| POST | `/compliance/consent/revoke` | Revoke specific consent |
| POST | `/compliance/erase/:userId` | Anonymise user data (Right to Erasure) |

---

## 🔍 Reconciliation (Express)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/reconcile` | Submit reconciliation batch |
| GET  | `/reconcile/pending` | List pending tasks awaiting approval |
| POST | `/reconcile/:id/approve` | Approve a pending task |
| POST | `/reconcile/:id/reject` | Reject a pending task |

---

## 📒 Ledger (Express)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ledger/entry` | Post a balanced journal entry |
| GET  | `/ledger/summary` | Balance per account |

---

## 🤖 Jarvis Bridge (Express → FastAPI)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/jarvis/forecast` | Proxy to FastAPI `/ai/forecast/revenue` |
| POST | `/jarvis/anomaly` | Proxy to FastAPI `/anomaly` |

---

## 🔒 Security Notes

- All non-GET requests are automatically logged to `immutable_audit_logs` (SHA-256 hashed)
- RBAC enforced: `admin` · `finance` · `ops` · `support`
- TLS required in production (NGINX ingress + `--force-ssl-redirect`)
- `x-tenant-id` header mandatory — missing header returns **401 Unauthorized**
- AI agent writes **only** to `pending_tasks` — never directly to `journal_entries`

# PROJECT JARVIS — Master Deployment Guide

> Deliverable S · Final Documentation  
> Status: **Production-Ready** · Deliverables A–S complete

---

## 1. Architecture Overview

```
Internet ──► NGINX Ingress (TLS) ──► NestJS API Gateway (port 3000)
                                          │
                 ┌────────────────────────┼────────────────────────┐
                 ▼                        ▼                        ▼
         FastAPI ML Agent         Worker Service          Durable Functions
           (port 8000)             (port 4000)          (Azure / Temporal)
                 │                        │
        ┌────────┴──────┐       ┌─────────┴──────┐
        ▼               ▼       ▼                 ▼
    MongoDB       PostgreSQL  Redis          Blob Storage
 (user/audit)   (accounting) (cache)      (immutable archive)
```

---

## 2. Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Node.js | 20.x |
| Python | 3.11 |
| pnpm | 8.x |
| Docker | 24.x |
| Helm | 3.14 |
| Azure CLI | 2.57 |
| kubectl | 1.29 |

---

## 3. Local Development Setup

### 3.1 Clone & Install

```bash
git clone https://github.com/ALGOEARTH/Backend.git
cd Backend

# Install all workspace packages
pnpm install

# Install Express app deps (root)
npm install

# Install NestJS gateway deps
cd apps/api-gateway-nest && npm install && cd ../..

# Install Python ML agent deps
cd apps/ml-agent-fastapi && pip install -r requirements.txt && cd ../..
```

### 3.2 Environment Variables

```bash
cp .env.example .env
# Edit .env with your credentials
```

Key variables:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `DATABASE_URL` | PostgreSQL DSN |
| `JWT_SECRET` | JWT signing secret |
| `ML_AGENT_URL` | FastAPI service URL |
| `TEMPORAL_ADDRESS` | Temporal server address |
| `KEYVAULT_NAME` | Azure Key Vault name (prod only) |
| `GOOGLE_SA_KEY_PATH` | Google service-account key for Drive |
| `OTLP_TRACE_URL` | OpenTelemetry collector endpoint |
| `TLS_KEY_PATH` | TLS private key path (prod only) |
| `TLS_CERT_PATH` | TLS certificate path (prod only) |

### 3.3 Start All Services

```bash
# Start databases + all services
docker compose up -d

# Verify all containers are healthy
docker compose ps
```

### 3.4 Run Prisma Migrations (Postgres)

```bash
cd libs/db
npx prisma migrate deploy
npx prisma generate
# Apply the Power BI budget-variance view
psql $DATABASE_URL -f prisma/migrations/001_budget_variance_view.sql
```

---

## 4. Service Start Commands

| Service | Command |
|---------|---------|
| Express API (legacy) | `npm run dev` |
| NestJS Gateway | `cd apps/api-gateway-nest && npm run start:dev` |
| FastAPI ML Agent | `cd apps/ml-agent-fastapi && uvicorn main:app --reload` |
| Temporal ML Worker | `cd apps/ml-agent-fastapi && python temporal_worker.py` |
| Temporal Worker (TS) | `cd apps/worker-service && npm start` |

---

## 5. CI/CD Pipeline

```
git push main
    │
    ├── Lint (ESLint + flake8)
    ├── Tests (Jest + pytest)
    ├── Security (CodeQL + dependency-review)
    ├── Docker build (api-gateway, ml-agent)
    ├── Push → Azure Container Registry (ACR)
    └── Helm upgrade → AKS
```

Workflows in `.github/workflows/`:
- `build-test-deploy.yml` — main CI/CD pipeline
- `lint.yml` — lint on every push/PR
- `security-scan.yml` — CodeQL weekly + PR dependency review

---

## 6. AKS Deployment

### 6.1 Connect ACR to AKS

```bash
az aks update \
  -n myAKSCluster \
  -g myResourceGroup \
  --attach-acr myRegistry
```

### 6.2 Deploy Helm Chart

```bash
helm upgrade --install backend-suite ./infra/k8s/helm \
  --namespace backend \
  --create-namespace \
  --set image.repository=myregistry.azurecr.io \
  --set image.tag=latest \
  --wait
```

### 6.3 Verify Deployment

```bash
kubectl get pods -n backend
kubectl get svc -n backend
kubectl get ingress -n backend
```

### 6.4 TLS via cert-manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
kubectl apply -f infra/k8s/cluster-issuer.yaml
```

---

## 7. Security & Compliance

### 7.1 Azure Key Vault

```bash
# Create vault
az keyvault create --name jarvis-keyvault --resource-group myRG --location eastus

# Store secrets
az keyvault secret set --vault-name jarvis-keyvault --name "DB-Password" --value "..."
az keyvault secret set --vault-name jarvis-keyvault --name "JWT-Secret" --value "..."
```

### 7.2 Immutable Audit Logs

- **PostgreSQL table**: `immutable_audit_logs` — SHA-256 hashed, append-only
- **MongoDB collection**: `audit_logs` — every mutating API call
- **Azure Blob**: immutable archive, 7-year retention

### 7.3 RBAC Roles

| Role | Access |
|------|--------|
| `admin` | All resources |
| `finance` | Ledger, invoices, GST |
| `ops` | Bookings, rooms, reconciliation |
| `support` | Guests, tickets (read-only) |

### 7.4 GDPR / DPDP Compliance

- `POST /api/v1/compliance/consent` — record consent
- `GET  /api/v1/compliance/consent/:userId` — right to access
- `POST /api/v1/compliance/consent/revoke` — withdraw consent
- `POST /api/v1/compliance/erase/:userId` — right to erasure

---

## 8. Monitoring & Observability

### 8.1 OpenTelemetry

Set environment variables to enable:

```env
OTLP_TRACE_URL=http://otel-collector:4318/v1/traces
OTLP_METRIC_URL=http://otel-collector:4318/v1/metrics
```

### 8.2 Grafana Dashboards

| Dashboard | Metrics |
|-----------|---------|
| Finance API | Request latency, error rate, GST invoice volume |
| ML Agent | Forecast accuracy, anomaly alerts, request/s |
| Workflow | Reconciliation approval rate, timeout rate |
| DB Health | Postgres WAL lag, MongoDB ops/s |

---

## 9. Backup Strategy

| System | Method | Retention |
|--------|--------|-----------|
| PostgreSQL | WAL archiving + pg_dump | 7 years |
| MongoDB Atlas | Continuous cloud backup (PITR) | 30 days |
| Audit Logs | Azure Blob immutable storage | 7 years |
| GST Invoices | Google Drive + Blob | 7 years |

Manual backup trigger:
```
POST /api/v1/backup/postgres
POST /api/v1/backup/mongo
```

---

## 10. Operational Playbook

### Incident: Service Outage
1. Check pod health: `kubectl get pods -n backend`
2. Inspect logs: `kubectl logs -n backend deploy/api-gateway`
3. Restart if needed: `kubectl rollout restart deploy/api-gateway -n backend`
4. Check ingress: `kubectl describe ingress backend-ingress -n backend`

### Incident: Security Breach
1. Revoke all JWT tokens (rotate `JWT_SECRET` in Key Vault)
2. Rotate all Key Vault secrets
3. Review `immutable_audit_logs` for breach timeline
4. File incident report with audit trail export

### Compliance Request
1. Data export: `GET /compliance/consent/:userId`
2. Data erasure: `POST /compliance/erase/:userId`
3. Log the action — interceptor writes to `immutable_audit_logs` automatically

### Periodic Reviews
- **Weekly**: Verify backup integrity, check anomaly alerts
- **Monthly**: Vulnerability scan (`npm audit`, `pip audit`), review Grafana dashboards
- **Quarterly**: Full compliance audit, Key Vault secret rotation, AKS node pool upgrade

---

## 11. Compliance Checklist

| Control | Status |
|---------|--------|
| TLS enforced on all endpoints | ✅ |
| Secrets in Azure Key Vault | ✅ |
| Immutable audit logs (SHA-256) | ✅ |
| GDPR/DPDP consent management | ✅ |
| Right to access + erasure APIs | ✅ |
| Double-entry ledger balanced | ✅ |
| Multi-tenant isolation (`tenantId`) | ✅ |
| AI writes only to `pending_tasks` | ✅ |
| Human-in-the-loop for ledger commits | ✅ |
| CodeQL security scanning in CI | ✅ |
| 7-year financial data retention | ✅ |
| HPA auto-scaling on AKS | ✅ |

---

*Project Jarvis · Deliverables A–S · Enterprise ERP + AI Backend*

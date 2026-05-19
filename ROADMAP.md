# Jarvis Backend — Master Roadmap

> **"The Father of Every Backend"** — Multi-tenant, JSON NoSQL, Offline-First Platform
> Covers: Marketing Agency, Portfolio, Ecommerce, SaaS, Billing/GST/Accounting, ERP, CRM, POS, Hotel Management

---

## Architecture Pillars

| Pillar | Implementation |
|--------|---------------|
| **Storage** | JSON file-backed NoSQL (local embedded DB) — zero external connections |
| **Multi-Tenancy** | Shared collection with `tenant_id` + strict RBAC |
| **Master Admin** | Single global identity with policy-driven cross-app access |
| **Audit** | Immutable, append-only JSON audit trail with SHA-256 hashing |
| **Auth** | Self-contained JWT/HMAC — local verification only |
| **Accounting** | Double-entry ledger with GST compliance |
| **Schema** | JSON Schema Draft-07 validation on every write |

---

## File Map

```
ROOT/
├── ROADMAP.md                  ← This file
├── Server.js                   ← Entry point (NoSQL-first)
├── src/
│   ├── config/
│   │   ├── database.js         ← MongoDB adapter (legacy fallback)
│   │   ├── jsonDb.js           ← JSON file DB engine (PRIMARY)
│   │   └── logger.js           ← Winston logger
│   ├── middlewares/
│   │   ├── authMiddleware.js   ← JWT + RBAC + Master Admin support
│   │   ├── tenantMiddleware.js ← x-tenant-id enforcement
│   │   ├── auditMiddleware.js  ← Immutable JSON audit trail
│   │   ├── errorMiddleware.js  ← Global error handler
│   │   ├── validateMiddleware.js ← JSON Schema validation
│   │   └── masterAdmin.js      ← Master Admin policy engine
│   ├── models/
│   │   ├── JsonModel.js        ← Mongoose-compatible model factory
│   │   ├── User.js, Booking.js, Invoice.js, ... ← Domain models
│   │   └── schemas/            ← JSON Schema Draft-07 files
│   │       ├── user.schema.json
│   │       ├── invoice.schema.json
│   │       ├── tenant.schema.json
│   │       ├── masterAdmin.schema.json
│   │       ├── ledger.schema.json
│   │       └── ... (one per domain)
│   ├── cli/
│   │   └── dbctl.js            ← Backup, restore, migrate, import, compact, audit
│   ├── data/                   ← JSON data files (one per collection)
│   └── modules/                ← Agency, CRM, ERP, POS, etc.
├── data/                       ← All JSON collections live here
└── .env.example                ← USE_JSON_DB=true by default
```

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [x] JSON file DB engine (`jsonDb.js`) — full MongoDB-compatible API
- [x] Mongoose-compatible model factory (`JsonModel.js`)
- [ ] ESLint flat config (`eslint.config.js`) — fix v9 compatibility
- [ ] Package.json — fix test script (`--testPathPatterns`)
- [ ] `.env.example` — add `USE_JSON_DB=true` as default

### Phase 2: Master Admin & Auth
- [ ] Master Admin global identity (separate from tenant users)
- [ ] `masterAdmin.js` policy engine — app/tenant/role/resource resolution
- [ ] `authMiddleware.js` — support Master Admin JWT claims
- [ ] Immutable login/action audit for Master Admin

### Phase 3: JSON Schema Validation
- [ ] JSON Schema files for all 18 domains
- [ ] `validateMiddleware.js` — validate on every create/update
- [ ] Schema versioning and migration support

### Phase 4: Immutable Audit Trail
- [ ] `auditMiddleware.js` — write to JSON `audit_logs` collection
- [ ] SHA-256 hashing for immutability
- [ ] Append-only enforcement
- [ ] Before/after snapshots on every write

### Phase 5: CLI Tools
- [ ] `dbctl backup` — full data backup to tar.gz
- [ ] `dbctl restore` — restore from backup
- [ ] `dbctl migrate --dry-run` — transform legacy data shapes
- [ ] `dbctl migrate --apply` — execute migration
- [ ] `dbctl import --file=data.json` — bulk import
- [ ] `dbctl compact --collection=X` — compaction for large blobs
- [ ] `dbctl audit --from=ISO --to=ISO` — query audit trail

### Phase 6: GST & Double-Entry Ledger
- [ ] LedgerEntry schema (double-entry with debit/credit arrays)
- [ ] Invoice schema (GSTIN, HSN, tax rates, reverse charge)
- [ ] `ledgerService.js` — post, reverse, reconcile entries
- [ ] GST return export (GSTR-1, GSTR-3B format fields)

### Phase 7: Multi-Platform Module Updates
- [ ] Agency module — project/deliverable/task tracking
- [ ] CRM module — contact/lead/opportunity pipeline
- [ ] POS module — offline-first receipt + sync
- [ ] Ecommerce — product/catalog/order/inventory
- [ ] Hotel — room inventory/booking/rate calendar
- [ ] All other modules verified for JSON DB compatibility

### Phase 8: Testing & Verification
- [ ] Unit tests: invoice creation, ledger posting, payment reconciliation
- [ ] Integration tests: CRM lead→opportunity→sale, POS checkout, order lifecycle
- [ ] Migration tests: legacy→canonical shape transform
- [ ] Audit immutability verification
- [ ] Multi-tenant isolation test
- [ ] Master Admin policy enforcement test

### Phase 9: Documentation & Handover
- [ ] README update (NoSQL-first setup)
- [ ] Migration runbook
- [ ] Backup/restore walkthrough
- [ ] Monitoring checklist (disk, index sizes, audit queue)

---

## Master Admin Design

```json
{
  "id": "master_admin_001",
  "type": "master_admin",
  "status": "active",
  "linked_apps": ["agency","portfolio","ecommerce","saas","billing","gst","accounting","erp","crm","pos","hotel"],
  "permissions": {
    "scope": "global",
    "mode": "policy_driven",
    "allow_impersonation": false
  },
  "auth": {
    "method": "local_json_auth",
    "mfa_enabled": true
  },
  "timestamps": {
    "created_at": "ISO8601",
    "updated_at": "ISO8601",
    "last_login_at": null
  }
}
```

**Rules:**
- One global identity — NOT copied into tenant collections
- Policy-driven resolution by app, tenant, role, resource
- Master Admin respects tenant isolation unless explicit global override
- NOT in tenant role lists — separate global identity

---

## Canonical JSON Domains

| Domain | Collection | Key Identifier |
|--------|-----------|----------------|
| Tenant | `tenants` | `tenant_id` |
| User | `users` | `user_id` |
| MasterAdmin | `master_admins` | `id` |
| Product | `products` | `product_id` |
| Catalog | `catalogs` | `catalog_id` |
| Order | `orders` | `order_id` |
| Invoice | `invoices` | `invoice_id` |
| Payment | `payments` | `payment_id` |
| LedgerEntry | `ledger_entries` | `entry_id` |
| GSTRecord | `gst_records` | `gst_id` |
| InventoryItem | `inventory` | `item_id` |
| POSReceipt | `pos_receipts` | `receipt_id` |
| CRMContact | `crm_contacts` | `contact_id` |
| Lead | `leads` | `lead_id` |
| Opportunity | `opportunities` | `opp_id` |
| Task | `tasks` | `task_id` |
| AuditEvent | `audit_logs` | `audit_id` |
| Settings | `settings` | `setting_id` |
| Booking | `bookings` | `booking_id` |
| Guest | `guests` | `guest_id` |
| Room | `rooms` | `room_id` |

---

## Behavioral Rules

1. No destructive changes without pre-dump and confirmation
2. Always dry-run before apply
3. Prefer backward compatibility; provide shims for breaking changes
4. All errors returned in JSON format only
5. Every record has `created_at` and `updated_at` (ISO 8601)
6. Every write produces an immutable audit event
7. Zero external connections for core operations

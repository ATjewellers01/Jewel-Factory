# Jewel Factory — Database Reference

Poora database ka naksha. **Source of truth = `prisma/schema.prisma`** — ye file
usko plain language me samjhati hai. Fresh DB banane ke liye kuch manual nahi:
`pnpm db:deploy` saari 24 migrations chala ke ye poora schema bana deta hai.

- **DB:** PostgreSQL (Supabase for dev, **AWS RDS in production**). ORM: **Prisma**. Supabase Auth use NAHI — sirf Postgres.
- **Vector search:** same Postgres DB me **pgvector** extension (`manufacturer_product_embeddings.embedding vector(512)`) — Qdrant replace kar chuka hai, koi alag vector-DB service nahi hai.
- **IDs:** sab `uuid`. **Timestamps:** `created_at` / `updated_at` har table pe.
- **Columns:** code me camelCase, DB me snake_case (`@map`).

---

## ⚠️ TERMINOLOGY TRAP (sabse zaroori — yaad rakho)

Hierarchy baad me add hui, phir ek display-text rename bhi hui, isliye table naam
UI naam se do partein alag hain:

| DB table | Code model | UI / asli matlab |
|---|---|---|
| `stores` | `Store` | **Purchase manager** (UI display name) — code/DB/routes me abhi bhi **"Retailer"** ya **"store"** hi kehlata hai (= Head Office; business jo manufacturer se deal karta hai, saare approvals bhi yahi karta hai) |
| `store_managers` | `StoreManager` | **LEGACY / INERT** — pehle "HO Manager" role tha, ab **role hata diya gaya** (Purchase manager hi Head Office hai). Table sirf historical approver references (reviewedBy / *ApprovedById) ke liye rakhi hai — login/creation ke liye use NAHI hoti. |
| `branches` | `Branch` | **Store** (purchase manager ki ek dukaan/branch) |
| `branch_managers` | `BranchManager` | **Store Manager** (ek branch chalata hai) |

> Code me "store" ka matlab **Purchase manager/Retailer** hai, dukaan nahi. Dukaan = `branch`.

> **Display-text rename (2026-07-30):** UI me ab "Retailer" har jagah **"Purchase manager"** dikhta hai
> (sirf display text — code/DB/routes/enum values sab "Retailer"/"store" hi rahenge). Isi tarah
> "B2B order" → "Catalog order", "Custom order" → "Customised order" (UI text only, `B2bOrder`/
> `CustomDesignOrder` models aur `OrderKind.B2B`/`OrderKind.CUSTOM` enums unchanged).

---

## Hierarchy (kaun kis se juda)

```
manufacturers (1)
  └─ stores [PURCHASE MANAGER (UI) / Retailer (code) = Head Office] (many)  stores.manufacturer_id → manufacturers.id (null jab tak approve na ho)
       ├─ store_managers [LEGACY/INERT] (many) store_managers.store_id → stores.id  (old HO Manager; role removed)
       └─ branches [STORE] (many)    branches.retailer_id → stores.id
            └─ branch_managers [STORE MGR] (many)  branch_managers.branch_id → branches.id
```

Customer ka koi table nahi — walk-in, PII store nahi hota.

---

## Tables — group ke hisaab se

### AUTH / IDENTITY
| Table | Kya |
|---|---|
| `manufacturers` | Global admin. email + bcrypt password. `retailer_badge_labels` (String[] — manufacturer khud custom badge labels banata hai e.g. "Gold Customer", har store pe `badge_label` se assign hota hai). `next_catalog_order_seq` / `next_custom_order_seq` (JFA-####/JFC-#### order-numbering counters, per manufacturer). |
| `stores` (**Purchase manager** — code: Retailer) | slug (kiosk), email (**nullable, doubles as login username when present**) + password (no password set at registration since 2026-07-30 — placeholder hash until approval sets it to the mobile number), registration_status (PENDING/APPROVED/REJECTED), branding (logo/tagline), fixed HO address, kiosk_pin_hash, extra_branch_allowance, `badge_label` (manufacturer-assigned custom badge). |
| `store_managers` (**legacy/inert** — old HO Manager, role removed) | store_id, email+password. Unique (store_id, email). Table remains for historical approver references; no login/creation. |
| `branches` (**Store**) | retailer_id, name, fixed address, phone, `restock_pin_hash`, is_active. |
| `branch_managers` (**Store Manager**) | branch_id, email+password. Unique (branch_id, email). |
| `password_reset_tokens` | email + role + hashed token + expiry. Purchase manager (owner) reset. |

### MANUFACTURER CATALOG (global, gold-only, no price)
| Table | Kya |
|---|---|
| `manufacturer_products` | design_number (JF-XXXX unique, **sole display identifier**), `name` (nullable, deprecated — design name removed 2026-07-30, unused by new products), category, sub_category, weight, purity, `pieces` (kitne physical pieces = weight, e.g. bangle pair = 2), `karigar_code` (manufacturer-internal only — kabhi retailer/store-manager ko dikhta nahi, structurally `omit`ted in every public query), `size` (optional, Bangles-only in the form), has_tryon, status (DRAFT/ACTIVE/ARCHIVED — DRAFT is displayed as "Inactive" in the UI, enum value unchanged). |
| `manufacturer_product_images` | product_id, S3/CloudFront url, is_primary, sort. |
| `manufacturer_product_embeddings` | product_id, **`embedding vector(512)`** (pgvector column, added by migration `pgvector` — replaced the old Qdrant `qdrant_point_id` design). |
| `favorite_products` | store_id + branch_id (null = Purchase manager ka apna favorite, set = us Store Manager ka) + manufacturer_product_id + **`kind`** (`FavoriteKind` enum: KIOSK/RESTOCK — a Store Manager's Kiosk and Restock pages keep separate favorite lists). Unique (store_id, branch_id, kind, manufacturer_product_id). Purchase manager aur Store Manager ka favorites list kabhi share nahi hota. |
| `karigars` | **(naya)** manufacturer-scoped master-list of Karigar codes (`lib/db/karigar.ts`) — backs the Karigar-assignment/dual-PDF feature (see below). Product-level `karigar_code` values are synced into this table on read (`syncKarigarCodes()`), never overwritten. |
| `manufacturer_categories` / `manufacturer_sub_category1` / `manufacturer_sub_category2` / `manufacturer_purities` | **(naya)** manufacturer-editable taxonomy tables — replacing the old static `lib/categories.ts` hardcoded list. Manufacturer can add/edit categories, two levels of sub-categories, and purity options per their own catalog. |

### STORE RETAIL CATALOG (B2B delivery pe materialize)
| Table | Kya |
|---|---|
| `products` | store_id (purchase manager), copied-from manufacturer product on B2B delivery (on status → COMPLETED, not the old "DELIVERED"). slug, stock. |
| `product_images` | product_id, url, is_primary. |
| `product_tryon_assets` | try-on PNG — manufacturer product YA store product ka. |

### ORDERS — 3 types (sab HO approval se manufacturer tak)
| Table | Kya |
|---|---|
| `kiosk_orders` | Customer order (Store Manager ne kiosk pe banaya). `branch_id`, `branch_name_snapshot`, `requirement_note` (editable, displayed as "Remark"), `completed_at` (Store Mgr marks), `delivery_date` (optional, set by Purchase manager on placement/approval). Customer PII **optional/nullable** (system me nahi rakhte). `pending_store_approval` gate. |
| `kiosk_order_items` | product snapshots (manufacturer_product_id + name/image/category) + **`status`** (per-line-item `OrderStatus`, independent of the order-level status) + **`customised_order_id`** (naya — links this item to a `CustomDesignOrder` once a Karigar is assigned to it). |
| `kiosk_order_status_history` | status timeline. |
| `b2b_orders` | Catalog order (branch → HO → manufacturer). `branch_id`, `branch_name_snapshot`, `requirement_note`, `completed_at`, `delivery_date` (optional), `pending_manager_approval` gate, fulfillment. |
| `b2b_order_items` | product snapshots + design number + image + **`status`** (per-line-item, same as kiosk) + **`customised_order_id`** (naya, same linking purpose). |
| `b2b_order_status_history` | status timeline. |
| `custom_design_requests` | Customised order requirement (branch se). branch_id, specs (sub_category, order_ref, delivery_date, quantity, meena, length, size, broadness, screw, sample_weight_grams), reference image(s), status (PENDING/APPROVED/REJECTED/FORWARDED), completed_at. Customer PII nullable. |
| `custom_design_orders` | Sanitized order to manufacturer (NO customer PII). Now carries the same spec fields as the request, plus **Karigar-assignment columns** (naya): `request_id` (now nullable — a second origin exists), `source_b2b_order_id` / `source_kiosk_order_id` (which order this Karigar assignment came from), `karigar_id`, `karigar_delivery_date`, `narration1`/`narration2`, `qc`, `order_type`, `order_stage`, `urgent`, `total_weight_grams`, `karigar_notes`, plus **O2D integration columns** (`o2d_order_id`/`o2d_order_no`/`o2d_sync_error` etc. — see `docs/O2D-INTEGRATION.md`, not duplicated here). |
| `retailer_custom_requests` | **(naya)** a Purchase manager's own bespoke request, PENDING until a manufacturer assigns a Karigar (at which point it becomes a real `custom_design_orders` row). Draws from the same JFA-#### counter as Catalog/Kiosk orders. |

### CHAT
| Table | Kya |
|---|---|
| `order_messages` | **Per-order chat Head Office (Purchase manager) ↔ Store Manager.** Polymorphic: (order_kind = KIOSK/B2B/CUSTOM, order_id). sender (`HO`/`STORE_MANAGER` — `HO` = the Head Office/Purchase-manager side; enum value is DATA, don't rename), sender_name, body. Scoped by store_id. Ek table teeno order-types ke liye. |

### TAXONOMY + INTELLIGENCE
| Table | Kya |
|---|---|
| `categories` | Legacy 14-category lookup table (source used to be `lib/categories.ts`) — being superseded by the manufacturer-editable `manufacturer_categories`/`manufacturer_sub_category1`/`manufacturer_sub_category2` tables above for new catalogs. |
| `product_views` / `tryon_events` / `product_sales` | store-scoped analytics signals. |

---

## Enums
`RegistrationStatus`(PENDING/APPROVED/REJECTED) · `ProductStatus`(DRAFT/ACTIVE/ARCHIVED, DRAFT displayed as "Inactive") ·
**`OrderStatus`** (reworked 2026-08-03 — **PENDING, IN_PROCESS, GHAT_RECEIVED, READY_FOR_DELIVERY, DISPATCHED, COMPLETED, CANCELLED**;
the old `PENDING/CONFIRMED/PACKED/SHIPPED/DELIVERED/CANCELLED` shape is gone — historical rows were remapped
by the migration itself: `CONFIRMED→IN_PROCESS`, `PACKED→GHAT_RECEIVED`, `SHIPPED→DISPATCHED`, `DELIVERED→COMPLETED`.
Applies to both Kiosk and Catalog/B2B orders, at both the order level AND the per-item level) ·
`CustomOrderStatus` (same rework applied) · `JewelleryType` · `ResetRole` ·
**`OrderKind`**(KIOSK/B2B/CUSTOM) · **`MessageSender`**(HO/STORE_MANAGER) · **`FavoriteKind`**(KIOSK/RESTOCK)

> **Don't reintroduce a `DELIVERED` check anywhere** — the B2B "materialize into store
> inventory" trigger and analytics queries that used to key off `'DELIVERED'` now key off `'COMPLETED'`.

---

## Migrations (24, all applied in order by `pnpm db:deploy`)

| # | Migration | Kya add |
|---|---|---|
| 1 | `jewel_factory` | Poora initial schema (manufacturers, stores, managers, catalog, 3 order types, categories, intelligence). |
| 2 | `kiosk_pin` | `stores.kiosk_pin_hash`. |
| 3 | `b2b_item_image` | b2b_order_items image + design snapshots. |
| 4 | `branch_hierarchy` | **branches + branch_managers** tables; orders pe branch_id + requirement_note; kiosk/custom PII nullable. |
| 5 | `order_messages` | **order_messages** table + `OrderKind`/`MessageSender` enums; kiosk/b2b/custom pe completed_at. |
| 6 | `add_analytics_indexes` | Analytics query performance ke liye indexes. |
| 7 | `custom_design_weight_range` | Custom design request pe weight range columns. |
| 8 | `pgvector` | `manufacturer_product_embeddings.embedding vector(512)` column — pgvector similar-search (replaces the old Qdrant point-id design). |
| 9 | `extra_branch_allowance` | `stores.extra_branch_allowance`. |
| 10 | `product_karigar_pieces_nullable_name` | `manufacturer_products.name` DROP NOT NULL; adds `pieces` + `karigar_code`. |
| 11 | `favorite_products` | **favorite_products** table. |
| 12 | `retailer_badges` | `manufacturers.retailer_badge_labels` + `stores.badge_label`. |
| 13 | `retailer_delete_cascade` | `b2b_orders`/`kiosk_orders`/`custom_design_orders` FK to stores: RESTRICT → CASCADE (retailer delete was silently broken for any retailer with order history). |
| 14 | `favorite_kind_kiosk_restock` | `FavoriteKind` enum (KIOSK/RESTOCK) + `kind` column on `favorite_products`; unique/index widened to include it. |
| 15 | `store_email_optional` | `stores.email` DROP NOT NULL + index on `owner_phone` — mobile-only purchase manager signup. |
| 16 | `custom_design_spec_fields` | Sub-category + counter spec fields (order ref, delivery date, quantity, meena, length, size, broadness, screw, sample weight) on BOTH `custom_design_requests` and `custom_design_orders`, all nullable. |
| 17 | `product_size` | Optional `size` on `manufacturer_products` — bangle sizing, form-gated to the Bangles category. |
| 18 | `custom_design_quantity_text` | `quantity` on custom design requests/orders widened `Int?` → `String?` — free text like "2 pcs". |
| 19 | `kiosk_sales_person` | `sales_code` + `sales_person_name` on `kiosk_orders` (later removed again — see Status in `CLAUDE.md`, kept here for migration-history completeness). |
| 20 | `order_status_rework` | `OrderStatus`/`CustomOrderStatus` enums replaced with the new PENDING/IN_PROCESS/GHAT_RECEIVED/READY_FOR_DELIVERY/DISPATCHED/COMPLETED/CANCELLED shape (see Enums above); historical rows remapped in-place. |
| 21 | `order_item_status` | `status OrderStatus` added to `kiosk_order_items`/`b2b_order_items` — per-line-item status, independent of order-level status. |
| 22 | `manufacturer_order_seq` | `manufacturers.next_catalog_order_seq`/`next_custom_order_seq` — backs JFA-/JFC- order numbers. |
| 23 | `order_delivery_date` | Optional `delivery_date DATE` on `b2b_orders` and `kiosk_orders`. |
| 24 | `karigar_assignment_phase1` | New **`karigars`** table + `CustomDesignOrder` extensions (`request_id` nullable, `source_b2b_order_id`/`source_kiosk_order_id`/`karigar_id`/`karigar_delivery_date`/`narration1`/`narration2`/`qc`/`order_type`/`order_stage`/`urgent`) + `customised_order_id` on `B2bOrderItem`/`KioskOrderItem` — backs the Karigar-assignment/dual-PDF feature. |

> A few later, smaller migrations exist beyond #24 in the same session's follow-up work
> (e.g. `karigar_form_extra_fields` adding `totalWeightGrams`/`karigarNotes`, and the O2D
> integration columns on `custom_design_orders`) — see `CLAUDE.md`'s own Migrations section
> for the exact current count, and `docs/O2D-INTEGRATION.md` for the O2D-specific columns.
> All are additive/nullable, no backfill, and all applied the same way: `pnpm db:deploy`.

Sab Prisma-managed migrations, applied idempotently where hand-authored (IF NOT EXISTS / DROP NOT NULL / DROP CONSTRAINT IF EXISTS) — partial re-run safe.

### Fresh DB
```bash
pnpm db:deploy   # all migrations, poora schema
pnpm db:seed     # manufacturer + 14 categories
```

### Existing DB ko upgrade (sirf tab jab pehle se data ho)
```bash
pnpm db:deploy            # nayi migrations
pnpm migrate:categories   # purani flat categories → 14-cat taxonomy
pnpm migrate:branches     # har retailer me default "Main Store" branch + purane orders link
```

> Supabase pooler pe `prisma migrate dev` advisory-lock pe atak sakta hai; isliye
> **fresh DB pe hamesha `pnpm db:deploy`** (migrate deploy) use karo. `db:migrate`
> (migrate dev) sirf tab jab tum khud local pe ek NAYI migration create kar rahe ho.
> Migrations idempotent hain toh safe.

---

## Tenancy (isolation rule)
- Purchase-manager-scoped queries: `storeId` (retailer id) se filter.
- Branch-scoped (Store Manager): `branchId` (guard cookie se; storeId = retailerId bhi set).
- Manufacturer: global catalog.
- `order_messages`: `storeId` se scoped — Head Office (Purchase manager) aur Store Manager sirf apne orders ke messages dekh sakte.
- Customer PII kabhi manufacturer tak nahi jaata.
- **Purchase manager delete (manufacturer action) ab poori tarah cascade karta hai** — `deleteStoreByManufacturer` (`lib/db/stores.ts`) transaction me: FK-cascading tables (branches, branch_managers, products, custom_design_requests, ab b2b/kiosk/custom orders bhi) automatically delete hote hain; jo tables sirf plain `storeId` string se scoped hain (koi FK nahi — `favorite_products`, `order_messages`, `product_views`, `tryon_events`, `product_sales`) unko explicitly delete kiya jaata hai store delete se pehle.

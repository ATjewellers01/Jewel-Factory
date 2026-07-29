# Jewel Factory — Database Reference

Poora database ka naksha. **Source of truth = `prisma/schema.prisma`** — ye file
usko plain language me samjhati hai. Fresh DB banane ke liye kuch manual nahi:
`pnpm db:deploy` saari migrations chala ke ye poora schema bana deta hai.

- **DB:** PostgreSQL (Supabase). ORM: **Prisma**. Supabase Auth use NAHI — sirf Postgres.
- **IDs:** sab `uuid`. **Timestamps:** `created_at` / `updated_at` har table pe.
- **Columns:** code me camelCase, DB me snake_case (`@map`).

---

## ⚠️ TERMINOLOGY TRAP (sabse zaroori — yaad rakho)

Hierarchy baad me add hui, isliye table naam UI naam se alag hain:

| DB table | Code model | UI / asli matlab |
|---|---|---|
| `stores` | `Store` | **Retailer** (= Head Office; business jo manufacturer se deal karta hai, saare approvals bhi yahi karta hai) |
| `store_managers` | `StoreManager` | **LEGACY / INERT** — pehle "HO Manager" role tha, ab **role hata diya gaya** (Retailer hi Head Office hai). Table sirf historical approver references (reviewedBy / *ApprovedById) ke liye rakhi hai — login/creation ke liye use NAHI hoti. |
| `branches` | `Branch` | **Store** (retailer ki ek dukaan/branch) |
| `branch_managers` | `BranchManager` | **Store Manager** (ek branch chalata hai) |

> Code me "store" ka matlab **Retailer** hai, dukaan nahi. Dukaan = `branch`.

> **Display-text rename (2026-07-30):** UI me ab "Retailer" har jagah **"Purchase manager"** dikhta hai
> (sirf display text — code/DB/routes/enum values sab "Retailer"/"store" hi rahenge). Isi tarah
> "B2B order" → "Catalog order", "Custom order" → "Customised order" (UI text only, `B2bOrder`/
> `CustomDesignOrder` models aur `OrderKind.B2B`/`OrderKind.CUSTOM` enums unchanged).

---

## Hierarchy (kaun kis se juda)

```
manufacturers (1)
  └─ stores [RETAILER = Head Office] (many)  stores.manufacturer_id → manufacturers.id (null jab tak approve na ho)
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
| `manufacturers` | Global admin. email + bcrypt password. **retailer_badge_labels** (naya — String[], manufacturer khud custom badge labels banata hai e.g. "Gold Customer", har store pe `badge_label` se assign hota hai). |
| `stores` (**Retailer** — UI: "Purchase manager") | slug (kiosk), email+password (**no password set at registration since 2026-07-30** — placeholder hash until approval sets it to the mobile number), registration_status (PENDING/APPROVED/REJECTED), branding (logo/tagline), fixed HO address, kiosk_pin_hash, extra_branch_allowance, **badge_label** (naya, manufacturer-assigned custom badge). |
| `store_managers` (**legacy/inert** — old HO Manager, role removed) | store_id, email+password. Unique (store_id, email). Table remains for historical approver references; no login/creation. |
| `branches` (**Store**) | retailer_id, name, fixed address, phone, **restock_pin_hash**, is_active. |
| `branch_managers` (**Store Manager**) | branch_id, email+password. Unique (branch_id, email). |
| `password_reset_tokens` | email + role + hashed token + expiry. Retailer (owner) reset. |

### MANUFACTURER CATALOG (global, gold-only, no price)
| Table | Kya |
|---|---|
| `manufacturer_products` | design_number (JF-XXXX unique, **sole display identifier**), **name (nullable, deprecated — design name removed 2026-07-30, unused by new products)**, category, sub_category, weight, purity, **pieces** (kitne physical pieces = weight, e.g. bangle pair = 2), **karigar_code** (manufacturer-internal only — kabhi retailer/store-manager ko dikhta nahi, structurally `omit`ted in every public query), has_tryon, status (DRAFT/ACTIVE/ARCHIVED). |
| `manufacturer_product_images` | product_id, cloudinary url, is_primary, sort. |
| `manufacturer_product_embeddings` | product_id, qdrant_point_id — photo-search index. |
| `favorite_products` | **(naya, 2026-07-30)** store_id + branch_id (null = Retailer ka apna favorite, set = us Store Manager ka) + manufacturer_product_id. Unique (store_id, branch_id, manufacturer_product_id). Retailer aur Store Manager ka favorites list kabhi share nahi hota. |

### STORE RETAIL CATALOG (B2B delivery pe materialize)
| Table | Kya |
|---|---|
| `products` | store_id (retailer), copied-from manufacturer product on B2B delivery. slug, stock. |
| `product_images` | product_id, url, is_primary. |
| `product_tryon_assets` | try-on PNG — manufacturer product YA store product ka. |

### ORDERS — 3 types (sab HO approval se manufacturer tak)
| Table | Kya |
|---|---|
| `kiosk_orders` | Customer order (Store Manager ne kiosk pe banaya). **branch_id**, branch_name_snapshot, **requirement_note** (editable), **completed_at** (Store Mgr marks). Customer PII **optional/nullable** (system me nahi rakhte). pending_store_approval gate. |
| `kiosk_order_items` | product snapshots (manufacturer_product_id + name/image/category). |
| `kiosk_order_status_history` | status timeline. |
| `b2b_orders` | Restock order (branch → HO → manufacturer). branch_id, branch_name_snapshot, requirement_note, completed_at, pending_manager_approval gate, fulfillment. |
| `b2b_order_items` | product snapshots + design number + image. |
| `b2b_order_status_history` | status timeline. |
| `custom_design_requests` | Custom requirement (branch se). branch_id, specs, reference image, status (PENDING/APPROVED/REJECTED/FORWARDED), completed_at. Customer PII nullable. |
| `custom_design_orders` | Sanitized order to manufacturer (NO customer PII, NO branch/note cols — post-approval artifact). |

### CHAT (naya)
| Table | Kya |
|---|---|
| `order_messages` | **Per-order chat Head Office (Retailer) ↔ Store Manager.** Polymorphic: (order_kind = KIOSK/B2B/CUSTOM, order_id). sender (`HO`/`STORE_MANAGER` — `HO` = the Head Office/Retailer side; enum value is DATA, don't rename), sender_name, body. Scoped by store_id (retailer). Ek table teeno order-types ke liye. |

### TAXONOMY + INTELLIGENCE
| Table | Kya |
|---|---|
| `categories` | 14 categories (source: `lib/categories.ts`). Lookup only. |
| `product_views` / `tryon_events` / `product_sales` | store-scoped analytics signals. |

---

## Enums
`RegistrationStatus`(PENDING/APPROVED/REJECTED) · `ProductStatus`(DRAFT/ACTIVE/ARCHIVED) ·
`OrderStatus`(PENDING/CONFIRMED/PACKED/SHIPPED/DELIVERED/CANCELLED) ·
`CustomStatus` · `CustomOrderStatus` · `JewelleryType` · `ResetRole` ·
**`OrderKind`**(KIOSK/B2B/CUSTOM) · **`MessageSender`**(HO/STORE_MANAGER)

---

## Migrations (order me — `pnpm db:deploy` sab chalata hai)

| # | Folder | Kya add |
|---|---|---|
| 1 | `20260711060610_jewel_factory` | Poora initial schema (manufacturers, stores, managers, catalog, 3 order types, categories, intelligence). |
| 2 | `20260711120000_kiosk_pin` | `stores.kiosk_pin_hash`. |
| 3 | `20260715120000_b2b_item_image` | b2b_order_items image + design snapshots. |
| 4 | `20260717000000_branch_hierarchy` | **branches + branch_managers** tables; orders pe branch_id + requirement_note; kiosk/custom PII nullable. |
| 5 | `20260718000000_order_messages` | **order_messages** table + enums; kiosk/b2b/custom pe completed_at. |
| 6 | `20260722000000_add_analytics_indexes` | Analytics query performance ke liye indexes. |
| 7 | `20260722010000_custom_design_weight_range` | Custom design request pe weight range columns. |
| 8 | `20260722090000_pgvector` | `manufacturer_product_embeddings.embedding vector(512)` column — pgvector similar-search. |
| 9 | `20260724000000_extra_branch_allowance` | `stores.extra_branch_allowance`. |
| 10 | `20260730000000_product_karigar_pieces_nullable_name` | `manufacturer_products.name` DROP NOT NULL; adds `pieces` + `karigar_code`. |
| 11 | `20260730010000_favorite_products` | **favorite_products** table. |
| 12 | `20260730020000_retailer_badges` | `manufacturers.retailer_badge_labels` + `stores.badge_label`. |
| 13 | `20260730030000_retailer_delete_cascade` | `b2b_orders`/`kiosk_orders`/`custom_design_orders` FK to stores: RESTRICT → CASCADE (retailer delete was silently broken for any retailer with order history). |

Sab hand-authored + **idempotent** (IF NOT EXISTS / DROP NOT NULL / DROP CONSTRAINT IF EXISTS) — partial re-run safe.

### Fresh DB
```bash
pnpm db:deploy   # migrations 1→13, poora schema
pnpm db:seed     # manufacturer + 14 categories
```

### Existing DB ko upgrade (sirf tab jab pehle se data ho)
```bash
pnpm db:deploy            # nayi migrations
pnpm migrate:categories   # purani flat categories → 14-cat taxonomy
pnpm migrate:branches     # har retailer me default "Main Store" branch + purane orders link
```

> Supabase pooler pe `prisma migrate dev` advisory-lock pe atak sakta hai; isliye
> `pnpm db:deploy` (migrate deploy) use karo. Migrations idempotent hain toh safe.

---

## Tenancy (isolation rule)
- Retailer-scoped queries: `storeId` (retailer id) se filter.
- Branch-scoped (Store Manager): `branchId` (guard cookie se; storeId = retailerId bhi set).
- Manufacturer: global catalog.
- `order_messages`: `storeId` se scoped — Head Office (Retailer) aur Store Manager sirf apne orders ke messages dekh sakte.
- Customer PII kabhi manufacturer tak nahi jaata.
- **Retailer delete (manufacturer action) ab poori tarah cascade karta hai** — `deleteStoreByManufacturer` (`lib/db/stores.ts`) transaction me: FK-cascading tables (branches, branch_managers, products, custom_design_requests, ab b2b/kiosk/custom orders bhi) automatically delete hote hain; jo tables sirf plain `storeId` string se scoped hain (koi FK nahi — `favorite_products`, `order_messages`, `product_views`, `tryon_events`, `product_sales`) unko explicitly delete kiya jaata hai store delete se pehle.

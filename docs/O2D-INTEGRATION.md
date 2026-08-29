# Jewel Factory ↔ Order-to-Delivery (O2D) Integration — Implementation Spec

**Who this is for:** the developer implementing this integration on BOTH
sides — Jewel Factory (this repo) and Order-to-Delivery (O2D, a separate,
already-in-production system: `at-order-to-dispatch-backend` + `at-order-
to-dispatch-frontend`). This document is the full spec for both halves.

**Status as of writing: nothing has been implemented yet on either side.**
This is a planning/spec document only. All application code in this repo
is exactly as it was before this integration was ever discussed — nothing
has been added, removed, or changed. The developer building this should
treat this file as the starting brief, build on a separate branch on both
repos, test locally first, and only merge/deploy after the standing
approval process (see §11) is followed.

---

## 1. The two systems, in one sentence each

- **Jewel Factory** — a B2B jewellery catalogue/ordering platform (Next.js +
  Hono + Prisma + Postgres). Manufacturers list designs; Purchase
  Managers/Store Managers place Catalog Orders against that catalogue.
  Manufacturers currently assign a Karigar (artisan) to produce specific
  order items using an in-house form (`components/orders/
  AssignKarigarModal.tsx`), which creates a Jewel-Factory-only tracking
  record (`CustomDesignOrder`, numbered `JFC-####`).
- **Order-to-Delivery (O2D)** — a separate, already-live production system
  (Node/Express + Prisma + Postgres backend, Next.js frontend) that tracks
  a physical piece of jewellery from being ordered from a Karigar through
  manufacturing stages to delivery. It already has its own real order
  creation flow, its own Karigar list, its own numbering, its own
  stage-tracking.

**The ask:** replace Jewel Factory's in-house Karigar-assignment flow with
one that creates a **real order inside O2D** instead — using O2D's own
order-creation UI, not a copy of it built inside Jewel Factory. O2D's own
order-numbering and stage-tracking becomes the source of truth for that
piece of work; Jewel Factory reads it back and displays it.

---

## 2. Full requirement — the flow, start to finish

### Step 1 — Retailer Admin places an order (unchanged)
A Purchase Manager/Retailer Admin (a Jewel Factory role) places a Catalog
Order through Jewel Factory as they already do. It gets a Jewel Factory
order number, `JFA-####`. **Nothing about this step changes.**

### Step 2 — Manufacturer selects items (unchanged)
The manufacturer opens that order in Jewel Factory's **Order Summary**
view (`components/orders/OrderSummaryModal.tsx`) and ticks a checkbox on
the specific line-items they want a Karigar to produce. **This UI does not
change.**

### Step 3 — Manufacturer clicks "Assign items" — opens O2D's Order Management UI, IN PLACE, NOT a new browser tab
This fully replaces the old in-house flow (`AssignKarigarModal` creating a
`JFC-####` record) — there is no chooser, no second button. Clicking
"Assign items":

1. Jewel Factory's backend creates a small local placeholder record (so it
   has something to poll for later, §8) and returns a reference id plus
   O2D's Order Management URL.
2. Jewel Factory opens that URL **in a popup window that stays visually
   anchored inside the current browser tab/window — not a new tab, not a
   new top-level browser window the manufacturer has to alt-tab to find.**
   Concretely: use a modal/popup mechanism (e.g. `window.open(url, name,
   'width=...,height=...')` sized and positioned so it reads as an overlay
   on the current page, not a full-window new tab) — **never `target=
   "_blank"` or a plain `<a>` link that spawns an ordinary new tab.** This
   is an explicit, non-negotiable requirement: the manufacturer should
   experience this as "a form popped up," not "a new tab opened."

### Step 4 — O2D's real Order Management UI loads inside that popup
This is **O2D's own actual UI** — the same order list + "Add New Order"
dialog that O2D's own staff already use to place a normal order. Nothing
about that UI's own normal behavior changes for O2D's own users. The popup
URL carries query params O2D's frontend needs to read (exact param names
TBD during implementation — see §5):
- A flag indicating "this session originated from Jewel Factory" — the
  trigger for the small O2D-side additions in Step 4a.
- A reference value Jewel Factory generated, which the form should carry
  through on submit so Jewel Factory can find the resulting order later.

**Login:** if the manufacturer isn't already logged into O2D in that
browser, O2D's normal login screen appears first. Whatever happens after
successful login must **preserve** the flag/reference values from the
original popup URL, so the manufacturer lands back on the right screen
with the right context intact, not on a generic dashboard having lost
them. (If O2D's current login flow doesn't already do this — i.e. if it
redirects to a fixed URL like `/login` and, after success, to a fixed URL
like `/dashboard`, dropping whatever the user was trying to reach — that
is itself a small thing to fix as part of this work, not something to
work around from Jewel Factory's side.)

### Step 4a — What O2D's frontend needs to do, precisely
Gated entirely on the "this came from Jewel Factory" flag, so O2D's own
users see zero difference when that flag is absent:

1. **Show the create-order form immediately** (if O2D's Order Management
   page is a list-with-a-dialog rather than a bare form, auto-open that
   dialog on load when the flag is present, so the manufacturer isn't
   dropped onto a plain order list and left to find the button
   themselves).
2. **Render the Jewel-Factory-originated item list underneath the form** —
   image, design number, category, weight, purity, quantity, exactly as
   captured when the item was added to Jewel Factory's catalogue. Two ways
   to get this data to O2D's frontend, pick whichever is less work:
   - **(a)** Encode it directly in the popup URL (a compact query param or
     short-lived token) — O2D's frontend just reads and renders it, no
     backend call needed.
   - **(b)** A small read-only fetch from Jewel Factory, using the
     reference id, to pull the item list for display.
3. **Carry the reference value through on submit** — store it on the new
   order row (a new column on O2D's side, §6).

All three are purely **display/UX additions on O2D's frontend** — the
actual order-creation logic (validation, Karigar selection, image upload,
whatever O2D's form already does) is untouched.

### Step 5 — Manufacturer fills O2D's form and submits
Whatever fields/validation/Karigar-picker/image-upload O2D's own form
already has, completely unchanged. The manufacturer picks a real O2D
Karigar from O2D's own Karigar list — Jewel Factory's own separate Karigar
master-list has no role in this flow. **This submit goes straight to O2D's
own existing create-order logic** — Jewel Factory's backend is not
involved in this specific call at all.

### Step 6 — O2D creates the order, storing Jewel Factory's reference
Because the form carried the reference value through, O2D's create-order
call stores it on the new order row (§6's new column). O2D's own numbering
runs exactly as it always does for this order — no special-casing based on
where the order came from.

### Step 7 — O2D is completely unaffected, for every other user
**This is the most important constraint in the whole integration.** An
order created this way is not special to O2D — it's created through the
exact same form, exact same validation, exact same numbering counter as if
an O2D staff member had opened the page directly and typed it in
themselves. Nothing about O2D's daily operation, performance, or behavior
for its own existing users changes because this integration exists.

### Step 8 — Jewel Factory discovers the new order by polling
Since Jewel Factory's backend didn't create the order itself, it doesn't
know O2D's new order id/number yet. So, lazily (on page load, not a cron
job — no background job runner exists in this codebase and none should be
introduced for this), Jewel Factory **searches** O2D for an order matching
the reference value it generated in Step 3. This needs one small new O2D
read capability (§7) — not a new endpoint category, ideally just one more
optional filter on an endpoint O2D's list page already has. Once found,
Jewel Factory stores O2D's order id and order number locally.

### Step 9 — O2D's order number shows up in Jewel Factory as "Customised Order No."
The number found in Step 8 replaces what used to be a Jewel-Factory-only
`JFC-####` number in the "Customised Order No." column of Jewel Factory's
Order Summary table (`components/orders/OrderSummaryModal.tsx`).

### Step 10 — Only 3 of O2D's stages get synced back
O2D tracks a piece through several internal production stages as work
happens (§8 lists what's known about O2D's stage vocabulary). Jewel Factory
only cares about an **exact, case-sensitive match** on three specific
stage values:

| O2D's stage value | Jewel Factory's mapped status |
|---|---|
| `"In Process"` | `IN_PROCESS` |
| `"Ready for Delivery"` | `READY_FOR_DELIVERY` |
| `"Complete"` | `COMPLETED` |

Any other value O2D's stage sits at (`"Pending"`, `"Reject"`, or any other
internal workflow-stage string) is **ignored** — Jewel Factory's own item
status doesn't change, doesn't clear, doesn't error. It just waits for the
next poll to see one of the three values above.

### Step 11 — Retailer Admin sees only the mapped 3-stage status
Never O2D's actual internal stage name or any other O2D workflow detail —
the Retailer Admin only ever sees whichever of `IN_PROCESS`/
`READY_FOR_DELIVERY`/`COMPLETED` currently applies to their order's items,
via Jewel Factory's existing per-item status badge UI (no new UI needed
there).

### Example — numbering with mixed traffic

| Order | How it was created | O2D's own order number |
|---|---|---|
| 1 | O2D's own staff, normal flow | (O2D's normal next number) |
| 2 | O2D's own staff, normal flow | (next after #1) |
| 3 | Manufacturer via Jewel Factory popup | (next after #2) |
| 4 | O2D's own staff, normal flow | (next after #3) |

The counter is continuous and shared — O2D's system doesn't distinguish
"where an order came from" for numbering. Orders created via Jewel Factory
additionally carry the reference value (§6); orders 1/2/4 above simply
don't have one (null).

---

## 3. Why not embed O2D's login-gated form directly, and why not a plain server-to-server API call either

Two designs were considered and explicitly rejected, so the reasoning is
recorded here to avoid re-litigating it:

- **A plain iframe embedding O2D's form:** O2D requires per-user login with
  no SSO/shared session with Jewel Factory. An iframe would either show
  O2D's login screen awkwardly inside a small frame, or require building
  session hand-off/SSO from scratch — bigger, riskier work than what's
  actually needed.
- **Jewel Factory's backend calling O2D's create-order API directly,
  server-to-server, with a Jewel-Factory-built form replicating O2D's
  fields:** rejected because the actual requirement is for the manufacturer
  to use O2D's own real UI (so O2D's own validation/Karigar list/image
  upload are automatically correct and never drift out of sync with a
  Jewel-Factory-side copy), not a parallel form Jewel Factory has to build
  and maintain.

**What was settled on instead:** a popup window (not a new tab — see §2
Step 3) that loads O2D's own real UI directly, with Jewel Factory handing
off just enough context (a flag + a reference value) via the URL, and
polling afterward for the result. This keeps O2D's own form as the single
source of truth for its own fields/validation, and keeps Jewel Factory's
role to the minimum: handing off, and reading back.

---

## 4. What Jewel Factory needs to build

### 4.1 — Retire the in-house Karigar-assignment flow for NEW work

`components/orders/AssignKarigarModal.tsx` (opened via "Assign items" in
`app/manufacturer/orders/page.tsx` / `components/orders/
CatalogOrderItemsBlock.tsx`) currently calls `POST /api/manufacturer/
{orders,kiosk-orders}/:id/assign-karigar` (`lib/api/routes/
manufacturer-karigar.ts`, backed by `lib/db/karigar.ts`'s
`assignKarigarToB2bItems`/`assignKarigarToKioskItems`) and creates a
`CustomDesignOrder` row numbered `JFC-####`.

**Going forward, this stops being what "Assign items" does — but it is not
deleted.** Every `CustomDesignOrder` row created *before* this change ships
stays exactly as it is: readable, untouched, still numbered `JFC-####`,
still linked to its `karigarId`. Nothing here is a data-deletion — "no data
deletion, ever, in either system" is a hard constraint for this whole
integration, on both Jewel Factory's and O2D's database.

The existing `assignKarigarToB2bItems`/`assignKarigarToKioskItems`
functions and their routes can stay in the codebase unused (they're also
still used by a separate flow, §4.4) — no cleanup of them is required as
part of this work.

### 4.2 — New/repurposed schema on `CustomDesignOrder`

`prisma/schema.prisma`'s `CustomDesignOrder` model already has the right
shape to be repurposed for this rather than building a new model — it
already links back to the originating Catalog/Kiosk order
(`sourceB2bOrderId`/`sourceKioskOrderId`) and is already the thing
`B2bOrderItem`/`KioskOrderItem`'s `customisedOrderId` foreign key points
at. Add new, nullable, additive fields to hold what O2D hands back:

```prisma
model CustomDesignOrder {
  // ...all existing fields unchanged, including on historical rows...

  o2dOrderId      String?   // O2D's own order id
  o2dOrderNo      String?   // O2D's own order number — becomes "Customised Order No." for new rows
  o2dSyncedStage  String?   // last O2D stage value that mapped to one of the 3 known buckets
  o2dLastSyncedAt DateTime? // when the last successful poll happened
}
```

A new `CustomDesignOrder` row created via this flow leaves the OLD
`karigarId`/`orderNumber` fields either null or populated with a
placeholder, since the `JFC-####` counter is retired for new rows (kept as
a column/migration for historical-row compatibility, not deleted).

Migration: new, additive, nullable, no backfill — same shape as every
prior migration in this project's history.

### 4.3 — New backend route(s)

Something like (exact naming is an implementation detail, not load-bearing
on the spec):

- A **hand-off** endpoint — takes the selected item ids, creates the
  placeholder `CustomDesignOrder` row (§4.2), links the selected items to
  it via `customisedOrderId`, advances their status to `IN_PROCESS` (same
  side effect the old in-house flow already produces, so no downstream
  item-status UI needs to change), and returns the reference value + O2D's
  popup URL for the frontend to open.
- A **status/poll** endpoint — given a `CustomDesignOrder` id, if its
  `o2dOrderId` isn't known yet, searches O2D by the reference value (§7);
  if it is known, re-reads that order directly. Persists whatever it
  learns (`o2dOrderId`/`o2dOrderNo`/`o2dSyncedStage`/`o2dLastSyncedAt`), and
  — only on an exact match against the 3-value table in §2 Step 10 —
  advances the linked `B2bOrderItem`/`KioskOrderItem` rows' status the same
  way the existing `advanceB2bOrderItemStatus`/`advanceKioskOrderItemStatus`
  (`lib/db/orders.ts`) already do. Reuse those functions, don't duplicate
  the status-advance logic.

Follow the existing external-service proxy pattern already in this
codebase (`lib/api/routes/manufacturer-ai.ts`, which forwards to an
external AI service with an API-key header and degrades gracefully — hides
the feature entirely — when the service isn't configured). New env vars
for O2D's base URL(s) and credential should follow the same optional,
graceful-degradation approach: if unset, "Assign items" is hidden, not
broken.

### 4.4 — What is explicitly out of scope, left untouched

- **The Retailer-Admin-bespoke-request flow**
  (`RetailerCustomRequestDetail` in `app/manufacturer/orders/page.tsx`) —
  this has no linked catalog items to select (a different origin from a
  Catalog/Kiosk order entirely) and stays on the old in-house
  `AssignKarigarModal`/`CustomDesignOrder` path. Not touched by this work.
- **Jewel Factory's own Karigar master-list CRUD UI**
  (`components/orders/KarigarAssignPanel.tsx`, `lib/db/karigar.ts`'s
  `listKarigars`/`addKarigar`/`removeKarigar`) — stays in place, since it's
  still used by the bespoke-request flow above. It just has no role in the
  new O2D-bound flow (the Karigar picker there is O2D's own).

### 4.5 — Polling trigger point

Lazy pull on page load — when the manufacturer's Catalogue Orders page
(`app/manufacturer/orders/page.tsx`) loads/refreshes, trigger the
status/poll check (§4.3) for every row still tracking an O2D assignment.
No cron job, no background worker — matches the existing "load on page
view" pattern already used elsewhere on that page.

---

## 5. Exact query-param/reference-value design — to be finalized during implementation

This document intentionally does not lock in exact param names/encoding,
since it depends on what's simplest to parse on O2D's actual frontend
(confirm during implementation, don't guess blind):
- What to name the "this came from Jewel Factory" flag and the reference
  value in the URL.
- Whether the item list (§2 Step 4a #2) is embedded in the URL or fetched
  from a small Jewel Factory endpoint — pick whichever is less work on
  O2D's frontend once its actual structure is in front of you.
- The exact popup-window dimensions/positioning so it reads clearly as an
  overlay, not a disconnected new tab (§2 Step 3 — this UX requirement is
  fixed; the pixel details are not).

---

## 6. What O2D needs to build — schema

One new, nullable, additive column on O2D's `Order` model — a reference
value Jewel Factory hands out, which O2D stores and returns but never
reads/validates/acts on itself. Exact column name/migration syntax is an
implementation detail; the requirement is: additive only, nullable, no
backfill, no change to any existing column or row.

The endpoint that creates a new order needs to accept this optional field
in its request body and persist it — this is expected to be a very small
addition (one field in whatever validation schema O2D's create-order
endpoint already uses, passed through to the database write the same way
its other optional fields already are).

---

## 7. What O2D needs to build — a way for Jewel Factory to find the order it created

Jewel Factory needs to search for an order by the reference value it
handed out (§2 Step 8) — since Jewel Factory doesn't know O2D's order id
until it finds it this way. Smallest shape: one more optional filter
parameter on whatever list/search endpoint O2D's frontend already uses to
list orders (if that endpoint's query-building code is a simple flat
filter object, this is very likely a one-line addition — confirm against
the actual code rather than assuming). No new endpoint category, no new
table.

An index on the new column is optional — only worth adding if this lookup
is used often enough to matter for query performance; Jewel Factory's own
polling volume is low (one search per pending assignment, until found,
then direct id-based reads afterward).

---

## 8. What's known about O2D's stage/status vocabulary

**This needs re-confirming directly against O2D's current code/database at
implementation time** — treat anything below as a starting point, not a
locked fact, since O2D is a live system that may have changed:

- O2D tracks an order's progress through a `currentStage`-type field that
  appears to be free text, not a strict enum — many different internal
  workflow actions can write different stage values into it.
  Jewel Factory only maps three specific values (§2 Step 10); everything
  else is ignored, so exact enumeration of O2D's full stage list isn't
  required for this integration to work correctly — only exact-string
  agreement on those three values matters.
- Confirm with O2D's own team/documentation what stage-transition
  mechanism(s) exist, so it's clear Jewel Factory only ever *reads* stage
  values and never calls any stage-changing endpoint itself.

---

## 9. How Jewel Factory reads results back — polling, not a webhook

**Recommended: Jewel Factory polls** (search by reference value until
found, then re-read by id) rather than O2D pushing updates via a webhook.
Reasoning: building a webhook means O2D adding new outbound-HTTP logic (if
none exists today) plus retry/failure handling, and Jewel Factory exposing
and defending a public receiver endpoint — meaningfully more new surface
area on both sides than a periodic read-only poll. Confirm during
implementation whether O2D already has any outbound-HTTP/webhook capability
at all before ruling this out completely, but default to polling unless
there's a strong reason not to.

---

## 10. Summary — the whole list of what's being asked of O2D

1. One new nullable column on the `Order` model, accepted as an optional
   field on the create-order endpoint (§6).
2. One new optional filter parameter on the existing order list/search
   endpoint, to look orders up by that new field (§7).
3. A frontend addition, gated on a URL flag: auto-open/show the create
   form, render a passed-through item list underneath it, carry the
   reference value through on submit (§4a).
4. A fix to the login flow so the flag/reference value survive a
   login-redirect if the manufacturer isn't already logged in (§2 Step 4).
5. Some way for Jewel Factory's backend to make the search/read calls in
   #2 without a human login — whatever authentication mechanism fits
   O2D's existing backend most naturally (a dedicated service credential,
   an API-key check, etc. — a design decision for whoever implements the
   O2D side, informed by how O2D's current auth actually works).

Nothing else — no new tables, no changes to O2D's existing stage/workflow
logic, no changes to how O2D's own users experience the product.

---

## 11. Ground rules for implementation

- **Both sides' code is built by the same developer** implementing this
  integration — this document is the shared spec for both halves.
- **Additive only, on both databases, always.** No existing column, row,
  or table is ever dropped, renamed, or destructively migrated as part of
  this work, on either side.
- **O2D's existing behavior for its own existing users does not change.**
  Every addition described here is gated so that without the "this came
  from Jewel Factory" signal, nothing is different.
- **Jewel Factory's existing behavior for its own existing users does not
  change**, beyond "Assign items" now doing something different — and even
  that only takes effect once O2D's side is actually built and configured;
  until then it should degrade to simply being unavailable, not broken.
- **Test locally on both sides first.** Do not point either side's local
  development environment at the other's live production system while
  building/testing. Build and verify end-to-end against local/non-
  production instances of both systems before anything is deployed
  anywhere.
- **No merge/deploy to either production environment without explicit
  sign-off** from whoever owns that decision, after local testing is
  complete on both sides.

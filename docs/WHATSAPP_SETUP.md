# WhatsApp Cloud API Setup — Meta (One-Sitting Guide)

Goal: set up Meta's WhatsApp Cloud API end-to-end in a single session, so you don't
have to log back into Meta multiple times. Do these steps **in order** — each one
unlocks the next. Budget **45–90 minutes** (business verification can take longer,
see Step 6).

By the end you will have 4 things to hand back to the developer:
1. **Permanent Access Token**
2. **Phone Number ID**
3. **WhatsApp Business Account ID (WABA ID)**
4. **Two approved template names** (password reset + account approval)

---

## Before you start — have these ready

- [ ] A **business email address** (not personal Gmail if possible)
- [ ] A **dedicated phone number** for WhatsApp Business — this number must **NOT**
      already be active on WhatsApp or WhatsApp Business app on any phone (a fresh SIM,
      a landline that can receive an OTP call, or a number you're ready to migrate off
      personal WhatsApp permanently)
- [ ] **Jewel Factory logo** — a square image, at least **640×640px**, PNG or JPG,
      plain/transparent background preferred (this becomes the WhatsApp profile photo
      customers see next to every message)
- [ ] Business details: legal business name, website (`jewelfactory.in` or similar),
      business address
- [ ] (Optional, speeds up verification) Business registration documents — GST
      certificate, incorporation certificate, or similar

---

## Step 1 — Create a Meta Developer Account

1. Go to **developers.facebook.com**.
2. Log in with a Facebook account (personal is fine — this account just becomes the
   *admin*, it's not customer-facing).
3. Click **"Get Started"** in the top right, accept the terms, and pick **"Business"**
   as your role when asked what you'll use the account for.

---

## Step 2 — Create a Meta App

1. From the Developer dashboard, click **"Create App"**.
2. **Use case**: choose **"Other"** → then **"Business"** as the app type.
3. Give it a name: `Jewel Factory Notifications`.
4. Link it to a **Business Portfolio** — if you don't have one, Meta will offer to
   create one right there. Name it `Jewel Factory` (or your registered business name).
5. Click **Create App**.

---

## Step 3 — Add the WhatsApp Product

1. On your new app's dashboard, find **"Add Product"** in the left sidebar or the
   product gallery.
2. Locate **WhatsApp** → click **"Set Up"**.
3. You'll land on **WhatsApp → API Setup**. Meta automatically provisions:
   - A **free test phone number** (Meta-owned, temporary — good for immediate testing
     without waiting on your own number's verification)
   - A **temporary access token** (valid 24 hours — Step 7 replaces this with a
     permanent one)
4. **Write down** (you'll see these on this exact page):
   - **Phone Number ID** (a long numeric ID next to the test number)
   - **WhatsApp Business Account ID** (labelled "WhatsApp Business Account ID" a bit
     further down the same page)

> These two IDs stay the same later when you switch from the test number to your real
> business number's WABA — so you can hand these to the developer *now* and update
> them once if the real number ends up under a different WABA (usually it won't).

---

## Step 4 — Add Your Real Business Phone Number

1. Still on **WhatsApp → API Setup**, click **"Add phone number"**.
2. Fill in:
   - Display name: `Jewel Factory` (this is what recipients see as the sender name —
     Meta reviews display names, so keep it exactly matching your real business name)
   - Category: **Retail** or **Shopping & Retail**
   - Description: one line about the business
3. Enter the dedicated phone number from your checklist.
4. Choose **SMS** or **Voice call** to receive the verification code.
5. Enter the OTP you receive. The number is now attached to your WABA.

---

## Step 5 — Set Up the Business Profile (Logo Goes Here)

1. Go to **WhatsApp Manager** (separate from the developer dashboard — Meta will
   link you there, or go directly to **business.facebook.com/wa/manage**).
2. Select your business phone number → **Profile** (or "Business Profile") settings.
3. Upload the **Jewel Factory logo** as the **profile photo** — this is the picture
   customers see next to every WhatsApp message from this number.
4. Fill in:
   - **About**: short tagline, e.g. "Jewel Factory — Gold Jewellery, B2B Platform"
   - **Address**: your business address
   - **Website**: your site URL
   - **Business hours**: optional
5. Save.

---

## Step 6 — Complete Business Verification

This step determines your **messaging limits** (how many conversations/day you can
start) and removes the "unverified" warning users might otherwise see.

1. In **Meta Business Suite / Business Settings** (business.facebook.com → gear icon
   → Business Settings), find **"Business Verification"** or **"Security Center"**.
2. Click **Start Verification**.
3. Enter your legal business name, address, and phone — must match your official
   documents.
4. Upload one of: GST certificate, certificate of incorporation, business license, or
   a recent utility bill in the business's name.
5. Submit. **Turnaround: a few hours to 2–3 business days.** You can continue with
   Step 7 onward while this is pending — it does not block token/template creation,
   it only affects your daily messaging volume tier.

---

## Step 7 — Generate a Permanent Access Token

The temporary token from Step 3 expires in 24 hours — do this so you never have to
log back in to regenerate it.

1. Go to **Business Settings** (business.facebook.com/settings) → **Users** →
   **System Users**.
2. Click **Add** → name it `jewel-factory-api-bot` → role: **Admin**.
3. Click **Add Assets** on the new system user → select your **App** (Jewel Factory
   Notifications) → give it **Full Control**.
4. Also click **Add Assets** → select your **WhatsApp Business Account** → give it
   **Full Control**.
5. Click **Generate New Token** on the system user:
   - App: select your app
   - Token expiration: choose **Never**
   - Permissions: check `whatsapp_business_messaging` and
     `whatsapp_business_management`
6. Click **Generate Token** → **copy it immediately and save it somewhere safe**
   (a password manager or a secure note) — Meta shows it only **once**.

This is your **permanent Access Token**. It does not expire unless you manually
revoke it.

---

## Step 8 — Create the Message Templates

WhatsApp requires every automated (business-initiated) message to use a **pre-
approved template** — you can't just send freeform text to someone who hasn't
messaged you first.

1. Go to **WhatsApp Manager → Account Tools → Message Templates** (or from the
   developer app: **WhatsApp → Message Templates**).
2. Click **Create Template** and create these two:

### Template 1 — Password Reset

| Field | Value |
|---|---|
| Name | `jewel_factory_password_reset` |
| Category | **Utility** |
| Language | English |

**Header** (type: None, or Text: `Jewel Factory`)

**Body:**
```
Hello {{1}},

We received a request to reset your Jewel Factory account password.

Tap the link below to set a new password. This link expires in 30 minutes:
{{2}}

If you didn't request this, you can safely ignore this message.

— Jewel Factory
```

**Footer:** `This is an automated message from Jewel Factory.`

---

### Template 2 — Account Approved

| Field | Value |
|---|---|
| Name | `jewel_factory_account_approved` |
| Category | **Utility** |
| Language | English |

**Header** (type: None, or Text: `Welcome to Jewel Factory`)

**Body:**
```
Hello {{1}},

Great news! Your Jewel Factory account has been approved.

Your login details:
User ID: {{2}}
Password: {{3}}

Sign in here: {{4}}

— Jewel Factory
```

**Footer:** `This is an automated message from Jewel Factory.`

---

3. Submit both for review. **Utility category templates are usually approved within
   minutes to a few hours.** You'll see the status change from "Pending" to
   "Approved" in the Message Templates list — refresh that page to check.

> **Note on the logo in templates:** WhatsApp template messages themselves don't
> carry a logo image inline — the logo shows automatically next to every message
> because it's your **profile photo** (Step 5). That's the "branding" that appears;
> templates can't embed a picture inline in the free-text body (only Marketing-
> category templates support a header image, which is unnecessary and slower to
> approve for simple Utility notifications like these).

---

## Step 9 — Hand These Off

Once Steps 7 and 8 are done, send the developer:

- [ ] **Access Token** (from Step 7)
- [ ] **Phone Number ID** (from Step 3, or Step 4's number if different)
- [ ] **WhatsApp Business Account ID** (from Step 3)
- [ ] Template names: `jewel_factory_password_reset`, `jewel_factory_account_approved`
      (only once both show **Approved** status)

That's everything needed to wire up:
- **Forgot password** → sent via WhatsApp using the reset template
- **Account approval notification** → sent via WhatsApp (and also via email if the
  retailer registered one) using the approval template
- User-friendly error messages if a WhatsApp send fails, instead of raw API errors

---

## Quick Troubleshooting Reference

| Problem | Fix |
|---|---|
| OTP not arriving on the business number | Try the "Voice call" option instead of SMS |
| Template stuck in "Pending" for a long time | Utility templates usually clear in hours; if stuck >24h, check the template wording didn't include promotional language (that can bump it to slower Marketing review) |
| "Number already registered to WhatsApp" | The number is active on a personal/Business app — you must log out and delete that app's account first, or use a different number |
| Business verification rejected | Double-check the business name/address on your documents matches exactly what you entered in Meta Business Settings, then resubmit |
| Token stops working after a while | You likely generated a token with an expiry instead of "Never" — repeat Step 7 |

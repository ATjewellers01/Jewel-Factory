# Jewel Factory — User Manual (सरल गाइड)

Ye manual koi bhi (non-technical person bhi) padh ke poora system chala sake — isi
tarah likha gaya hai. Har role, uska kaam, login credentials, aur step-by-step
kaam sab niche hai.

> **Ek line me:** Jewel Factory ek **B2B gold-jewellery ordering platform** hai jo
> **ek Manufacturer** ko uske **Purchase manager network** aur unke **in-store customers**
> se jodta hai — **koi price kahin nahi dikhti** (sirf gold ka business) aur
> **customer ki personal detail manufacturer tak kabhi nahi jaati**.

---

## 1. Ye system kyun banaya gaya (Purpose)

Purane tareeke me har jeweller apna alag hisaab rakhta tha — orders phone/WhatsApp
pe, koi tracking nahi, aur bade network me confusion. Jewel Factory ise ek jagah
laata hai:

- **Manufacturer** (factory) ka ek hi catalog — sabhi Purchase managers wahi dekhte hain.
- **Purchase manager** (shop-owner company) apne kai **Stores (branches)** chala sakta hai.
- Har Store ka **Store Manager** customer ke saamne kaam karta hai (kiosk pe order,
  try-on, custom design).
- Sab orders **Purchase manager (Head Office)** ke paas approval ke liye jaate hain,
  phir manufacturer ke paas — poori tracking ke saath.

**Design ke 4 pakke niyam (bahut important):**

1. **Price kahin nahi dikhti** — gold-only business hai, keemat roz badalti hai.
2. **Customer ki personal detail (naam/phone) manufacturer tak nahi jaati** — order
   me sirf product + quantity + ek "Remark" (requirement note) jaata hai.
3. **Manufacturer hamesha Purchase manager ke fixed Head Office address pe hi bhejta hai** —
   kisi branch ya customer ke ghar nahi. Purchase manager (Head Office) wahaan se branches me baantta hai.
4. **Har design ka apne aap number banta hai** — `JF-0001`, `JF-0002`… (manual nahi).
   Design ka koi "naam" nahi hota — sirf ye number hi uski pehchaan hai.

---

## 2. System me kaun-kaun hai (4 log)

| # | Role | Ye kaun hai | Kaam ek line me |
|---|------|-------------|-----------------|
| 1 | **Manufacturer** | Factory / admin | Catalog banata hai, Purchase managers approve karta hai, orders bhejta hai |
| 2 | **Purchase manager** (Head Office) | Jeweller company ka maalik | Apne Stores (branches) + staff banata hai, restock order karta hai, **sab orders approve karta hai + Store Managers se chat**, khud bhi seedha order de sakta hai |
| 3 | **Store Manager** | Ek shop chalane wala staff | Customer ke saamne kiosk/try-on/order/custom design |
| 4 | **Customer** (walk-in) | Dukaan me aaya grahak | Sirf dekhta hai — koi login nahi, koi detail store nahi hoti |

**Hierarchy:**
`Manufacturer → Purchase manager → Stores (branches) → Store Managers → Customer`

---

## 3. Login — kaha, kaise (URLs + Credentials)

Sabse pehla page: **home (`/`)** — ye ek branded Jewel Factory landing hai (navbar:
logo · Catalog · About · Login · Register, featured designs, aur ~5 sec baad ek
register-prompt). **Navbar ke "Login" pe click karo** → ek popup khulta hai jisme do
option hote hain: **Purchase manager** aur **Store Manager**. Apna chuno. (Manufacturer ka
login chhupa hua hai — seedha `/manufacturer` pe jao.) Chaaho to niche wale seedhe
login URLs bhi use kar sakte ho.

| Role | Login page | Demo Email | Demo Password |
|------|-----------|------------|---------------|
| **Manufacturer** | `/manufacturer/login` | `admin@atjewellers.com` | Password set in the database |
| **Purchase manager** (Head Office) | `/store/login` | `store@demo.com` | `store123` |
| **Store Manager** | `/store-manager/login` | *(banana padega — niche §7)* | *(jo banate waqt set karo)* |

> **Zaroori notes:**
> - Ye demo credentials sirf tab bante hain jab system fresh install pe seed hota
>   hai. **Manufacturer hamesha banta hai**; Purchase manager sirf demo mode
>   (`SEED_DEMO_STORE=true`) me. Live client ke liye password **turant badlo**.
> - **Store Manager ka koi default account nahi** — use Purchase manager
>   banata hai (§7 dekho).
> - **Mobile number se bhi login hota hai** — jinke paas email nahi hai unke liye
>   mobile number hi username aur password (mobile number) dono kaam karta hai.
> - Password field me **dot (••••)** dikhte hain; aankh 👁 icon se dekh sakte ho.
> - Galat password pe error dikhega aur button turant free ho jaata hai — sahi
>   daal ke dobara try karo.
> - **Password bhool gaye?** Login page pe "Forgot password?" link se reset email
>   aata hai. (Ye abhi sirf email waalo ke liye kaam karta hai — sirf mobile number
>   wale account ko apne profile me pehle email add karni hogi.)
> - Purchase manager, Store Manager aur Manufacturer ke full-page login ek hi responsive
>   portal layout use karte hain: desktop/tablet pe do panels aur mobile pe ek
>   clean panel. Login form beech me rehta hai. Registration me lamba
>   form sirf right panel ke andar scroll hota hai; card ke bahar overflow nahi
>   karta.

---

## 4. Har Role ka poora kaam (menu-wise)

### 4.1 Manufacturer (`/manufacturer/…`)
Factory/admin. Ye dekhta/karta hai:

- **Dashboard** — catalog, orders, Purchase managers ka overview.
- **Catalog** — designs add/edit karo (gold only, **no price**, number auto `JF-XXXX`).
  - *Design add karne ka tarika §8 me.*
- **Catalogue Orders** — Restock/Kiosk/Customised — sab ek merged list me, kis
  Purchase manager se aaya dikhta hai.
- **Custom Designs** — customer ke special design orders (sirf specs, no customer data).
- **Purchase Managers** — approved Purchase managers manage karo (naam/email/phone edit, password reset, delete). Har Purchase manager ko ek custom **badge** (jaise "Gold Customer", "Premium") bhi assign kar sakte ho.
- **Purchase Manager Registrations** — naye Purchase manager ke sign-up **Approve / Reject** karo.

**Kya NAHI dikhta:** customer ka naam/phone/ghar ka address — kuch bhi nahi. Sirf
Purchase manager ka business naam, requirement note, aur Purchase manager ka Head Office ship address
(city ya branch ka naam bhi manufacturer ko nahi dikhta).

### 4.2 Purchase manager / Head Office (`/store/…`)
Company ka maalik — **ye hi Head Office hai**. Poora menu dikhta hai, aur ye khud
**sab approvals + chat** bhi sambhalta hai (jo pehle alag "HO Manager" karta tha):

- **Dashboard**, **Pending Approvals**, **Order History** (Restock/Kiosk/Customised sab ek list me), **Custom Designs**
- **Manufacturer Catalogue** — poora catalog dekho + restock order banao, apna khud ka Catalog order ya Customised order bhi seedha bana sakte ho.
- **Intelligence / Analytics** — demand/insights.
- **Stores (Branches)** — apne shops + Store Managers banao (§7).
- **Purchase Manager Profile** — company detail + fixed delivery (Head Office) address.
- **Favorites** — pasand ke designs heart ♥ icon se save karke ek jagah dekho.
- **Settings** — company settings.

**Approvals + chat (pehle HO Manager karta tha, ab Purchase manager khud):** har branch ke
saare orders **approve/reject** karna, requirement note (Remark) edit karna, order pe
**delivery date** set karna, aur Store Managers se **chat** karna. Manufacturer ke
paas order tabhi jaata hai jab Purchase manager (Head Office) approve karta hai —
**siwaye us order ke jo Purchase manager khud seedha place karta hai** (wo apne
aap approve maana jaata hai, kyunki uske upar approve karne wala koi aur nahi hai).

### 4.3 Store Manager (`/store-manager/…`)
Ek shop chalane wala staff. Customer ke saamne isi device pe kaam karta hai:

- **Home**
- **Catalog** — customer ko designs dikhao, order me daalo. Favorites (♥) se pasand
  ke design save karo.
- **Try-On** — AR se gehna face/neck pe laga ke dikhao.
- **Search** — photo se milta-julta design dhoondho.
- **Custom Design** — customer ka special order form (image + specs + note).
- **Restock** — manufacturer se stock mangao (**PIN se khulta hai**). Restock ki
  apni alag Favorites list hoti hai — Kiosk waali se milti nahi.
- **My Orders** — apne bheje **saare orders ek list me** (Restock/Kiosk/Customised —
  sab merged, har order pe kis type ka hai ye badge dikhta hai), search + status +
  date filter, Head Office (Purchase manager) se chat, aur pahunchne pe **Mark
  Completed** karo.

**Store Manager ko manufacturer ka detailed status nahi dikhta** — sirf:
Pending / Approved by Head Office / Rejected / Completed.

### 4.4 Customer (walk-in — koi login nahi)
Store Manager ke device pe browse karta hai: catalog dekhna, AR try-on, photo
search, custom design maangna. **Uski koi bhi personal detail system me save nahi
hoti** — Store Manager use apne paas rakhta hai; system me sirf "Remark"
(requirement note) jaata hai.

---

## 5. Orders kaise chalte hain (flows)

Zyadatar orders ka **ek hi rasta**: Store Manager banata hai → **Purchase manager
(Head Office) approve karta hai** → Manufacturer ke paas jaata hai → Manufacturer
Purchase manager ke Head Office address pe bhejta hai → Head Office branch ko deta
hai → Store Manager **Mark Completed** karta hai.

> **Order number:** Kiosk aur Catalog (restock) order ek hi series se number
> paate hain — **`JFA-####`**. Customised order (custom design) ka apna alag
> number hota hai — **`JFC-####`**.

### (a) Kiosk order (customer catalog se kharidta hai)
1. Store Manager kiosk pe order banata hai: products + quantity + Remark
   (customer ka naam/phone nahi).
2. Purchase manager (Head Office) ko dikhta hai "Store X ne bheja" — Remark edit kar sakta hai — chaho to **delivery date** set karo — phir **Approve**.
3. Manufacturer ko milta hai (Remark + branch ka naam; koi customer data nahi).
4. Manufacturer Purchase manager ke Head Office address pe bhejta hai; Head Office branch ko deta hai.
5. Beech me Head Office ↔ Store Manager **chat** kar sakte hain; pahunchne pe Store Manager
   **Mark Completed**.

### (b) Custom design request (customer ko special piece chahiye)
1. Store Manager `Custom Design` form bharta hai: category, weight, purity, note,
   reference image (customer detail nahi).
2. Purchase manager (Head Office) **Approve & Forward** karta hai (chat bhi kar sakta hai).
3. Manufacturer ko sanitized order milta hai (number `JFC-####`), koi customer data nahi.
4. Manufacturer Head Office address pe bhejta hai; Store Manager track + **Mark Completed**.
   (Full manufacturer status sirf Purchase manager (Head Office) ko dikhta hai.)

### (c) Restock / Catalog order (shop stock mangata hai)
1. Store Manager `Restock` kholta hai → **branch ka Restock PIN** daalta hai.
2. Manufacturer catalog se order karta hai.
3. Purchase manager (Head Office) approve karta hai.
4. Manufacturer Head Office address pe bhejta hai; order **Completed** hote hi stock Purchase manager ke
   product list me aa jaata hai.
5. Chat + Mark Completed same.

### (d) Purchase manager khud seedha order de (naya)
Purchase manager `Manufacturer Catalogue` se khud Catalog order bana sakta hai, ya
Custom Designs se seedha ek Customised order request bhej sakta hai — kisi branch
se guzre bina. Iske upar approve karne wala koi aur nahi hai, isliye ye order
**apne aap approve** ho jaata hai aur seedha manufacturer ke paas chala jaata hai
(Pending Approvals list me nahi dikhta).

> **Remark (requirement note)** = customer ki demand (size, engraving, kab tak chahiye).
> Store Manager likhta hai, Purchase manager (Head Office) bhi edit kar sakta hai, aur ye
> manufacturer tak jaata hai. **Isme kabhi personal detail mat likho.**

---

## 6. Order status (kya-kya stage hoti hai)

Manufacturer + Purchase manager (Head Office) ko order ka poora status dikhta
hai — ye stages hoti hain, ek ke baad ek:

**Pending → In Process → Ghat Received → Ready for Delivery → Dispatched →
Completed** (ya **Cancelled**, agar order cancel ho jaaye)

Ek hi order ke alag-alag product (line item) alag-alag stage pe ho sakte hain —
jaise ek item "Dispatched" ho chuka ho jabki dusra abhi "In Process" me hi ho.

Store Manager ko ye poora status nahi dikhta — sirf simple bucket dikhta hai
(§4.3 me dekha): Pending / Approved by Head Office / Rejected / Completed.

---

## 7. Orders dhoondhna / filter karna (sab jagah)

Har order list pe (Purchase manager/Head Office, Manufacturer, Store Manager — sab):

- 🔍 **Order-ID search** — order number type karo (jaise `JFA-0001`, `JFC-0001`).
- **Status filter** — Pending / In Process / Ready for Delivery / Dispatched / Completed… dropdown.
- **From / To date** — kis date range ke orders chahiye.
- **Purchase manager (Head Office)** ke paas extra: **Store (branch) wise** filter (kaunsa order kis Store se aaya).
- **Manufacturer** ke paas extra: **Purchase manager wise** filter (kaunsa order kis Purchase manager se aaya).
- Order detail me: Purchase manager (Head Office) ko **branch** aur (agar set ho to) **delivery date** dikhta hai; Manufacturer ko **Purchase manager** ka naam aur delivery date dikhta hai.

---

## 8. Naye log kaise banaye (User creation)

### Purchase manager khud register kaise kare — `/store/register`
Purchase manager ek simple form bharta hai:
1. **Business Details:** Business name, Owner/Person name, Mobile number, Business
   email (optional — email na ho to mobile number hi login username ban jaata hai).
2. **Fixed Delivery Address (Head Office address):** Pincode (pehle daalo — city/state
   apne aap bhar jaate hain), Street, Landmark (optional).
3. **Password:** koi password set karne ki zaroorat nahi — approve hone ke baad
   **mobile number hi password ban jaata hai**.

Mobile pe form single-column ho jaata hai; desktop/tablet pe ek clean card.

Submit ke baad message: "Registration submitted — approval ke baad access milega."
Phir **Manufacturer approve karega** (niche).

### Manufacturer Purchase manager ko approve kare — `/manufacturer/store-registrations`
Pending Purchase managers ki list dikhti hai (naam, email/mobile, city, owner,
address). Har row pe **Approve** ya **Reject**. Approve karte hi Purchase manager ko
access mil jaata hai aur catalog se link ho jaata hai (email hone pe ek confirmation
email bhi jaata hai).

### Purchase manager Stores (branches) + Store Managers banaye — `/store/branches`
- **Add a Store (branch):** Store name*, phone, street, city, state, pincode,
  landmark. Har branch ka **Restock PIN** (min 4 digit) bhi set kar sakte ho.
- **Add Store Managers** (store expand karke): Name*, phone, Email*, Password (min 6)*.
  Active/inactive toggle, password reset, remove — sab yahaan.

---

## 9. Manufacturer design kaise add kare — `/manufacturer/catalog` → New

**Manual (hamesha available):**
1. Category / Sub-category / Weight / Purity chuno. (Sirf **Bangles** category ke
   liye ek extra **Size** field bhi dikhta hai.)
2. **Karigar Code** (optional — kaunsa karigar banayega) aur **Pieces**
   (default 1 — jaise bangle ka jodaa ho to 2).
3. **Catalog photo** upload karo (ek ya zyada).
4. Optional: **Try-On PNG** (transparent) upload karo (AR ke liye).
5. Status **Active** (visible) rakho → **Save**. Number `JF-XXXX` apne aap.

> **Design ka koi "naam" ab nahi likha jaata** — ye field 2026 me hata diya gaya,
> ab design number (`JF-XXXX`) hi hamesha uski pehchaan hota hai, catalog se
> lekar order tak, har jagah.

**Generate with AI (optional — tabhi dikhta hai jab AI service configured ho):**
1. Category/Weight/Purity chuno.
2. Ek **raw phone photo** upload karo (temporary, save nahi hoti).
3. **Generate** dabao → AI apne aap bhar dega: Description + sundar catalog
   image + transparent try-on PNG.
4. Kuch bhi edit kar sakte ho, ya custom instruction ke saath regenerate.
5. Review karke **Save**.

> Generated catalog/try-on image pe **click** karo to bada (zoom) dikhta hai.
> AI feature ko OpenAI credit chahiye — agar "generate" fail ho to billing check karo.

---

## 10. AR Try-On + Visual Search (Store Manager)

- **Try-On:** `Try-On` menu — camera on → list se piece chuno → face/neck pe
  overlay dikhta hai. Catalog ya Search se seedha "Try On" button bhi hai (wahi
  piece auto-select ho jaata hai), aur "← Back" se wahi page pe wapas.
- **Search:** `Search` → customer ki pasand ki koi photo upload karo → milte-julte
  catalog designs aa jaate hain → kisi pe click → detail + "Order from Catalog".

> **Mobile photo options:** **Take photo** phone ka rear camera kholta hai.
> **Choose photo** normal image picker kholta hai, jisse gallery ki purani photo
> select kar sakte ho. Desktop par Choose photo system file picker kholega.

---

## 11. Favorites (♥ pasand ke design save karo)

Kisi bhi product card pe **♥ heart icon** dikhta hai — click karke wo design apni
Favorites list me save ho jaata hai (dubara click se hat jaata hai). Ye list
server pe save hoti hai, isliye device badalne pe bhi list waisi hi rehti hai.

- **Purchase manager** ki apni ek Favorites list hoti hai.
- **Store Manager** ki apni branch ki Favorites list hoti hai — Purchase manager
  se alag.
- Store Manager ke liye **Kiosk** aur **Restock** ki Favorites bhi ek-dusre se
  alag hoti hain (dono jagah ke heart-clicks mix nahi hote).

---

## 12. Chat (Head Office ↔ Store Manager)

- Har order pe ek **Message** thread hai — dono taraf baat kar sakte hain.
- **Store Manager:** My Orders me "Message Head Office".
- **Purchase manager (Head Office):** Pending Approvals **aur** Custom Designs pe "Message".
- Ye chat sirf Head Office (Purchase manager) aur Store Manager ke beech — **customer/manufacturer ko nahi dikhta**.

---

## 13. Roz ka istemaal — quick checklist

**Store Manager (dukaan me):**
- Customer aaye → Catalog/Try-On/Search dikhao → order banao (Remark likho) → bhej do.
- My Orders me status dekhte raho; maal aane pe **Mark Completed**.
- Custom chahiye to Custom Design form; stock kam to Restock (PIN se).
- Pasand ke designs ♥ se Favorites me save karo, taaki baad me dhoondhna na pade.

**Purchase manager / Head Office (office me):**
- Pending Approvals roz check karo → Remark theek karo → delivery date daalo (agar chahiye) → **Approve** → manufacturer ko jaayega.
- Store Managers ke sawaal chat pe jawab do.
- Khud koi Catalog order ya Customised order seedha bhi bana sakte ho — wo apne aap approve ho jaata hai.
- Stores (branches), Store Managers, restock aur Purchase Manager Profile bhi yahin se sambhalo.

**Manufacturer (factory):**
- Naye Purchase Manager Registrations approve karo.
- Catalogue Orders (Kiosk/Restock/Customised) dekho → status aage badhao (In Process →
  Ghat Received → Ready for Delivery → Dispatched → Completed). Purchase manager ke
  Head Office address pe bhejo.
- Catalog me naye design add karte raho.

---

## 14. Aksar poochhe jaane wale (FAQ)

- **Price kyun nahi dikhti?** Gold roz badalta hai; keemat store apne hisaab se
  customer ko batata hai. System sirf design + order sambhalta hai.
- **Customer ka naam/phone kaha jaata hai?** Kahin nahi (system me). Store Manager
  apne paas rakhta hai. System me sirf Remark (requirement note).
- **Manufacturer maal kaha bhejta hai?** Hamesha Purchase manager ke fixed Head Office address pe.
- **Store Manager account kaise bane?** Purchase manager `Stores (Branches)`
  page se banata hai.
- **Login button ghoomta hi reh gaya?** Ab fix hai — galat password pe turant free
  ho jaata hai; sahi daalo.
- **"Generate with AI" nahi dikh raha?** Wo optional hai — tabhi aata hai jab AI
  service set ho. Manual add hamesha chalega.
- **Order number `CD-…` ya `B2B-…` kyun dikh raha hai?** Ye purane orders hain,
  naye system se pehle ke. Naye orders me hamesha `JFA-####` (Kiosk/Catalog) ya
  `JFC-####` (Customised) hi dikhega.
- **"Purchase manager" aur "Retailer" — dono same hain kya?** Haan — pehle isko
  "Retailer" bola jaata tha, ab UI me har jagah **"Purchase manager"** dikhta hai.
  Kaam wahi hai, sirf naam badla hai.

---

*Powered by Jewel Factory. Ye manual features ke saath update hota rahega — technical
detail ke liye `flow.md`, setup ke liye `HANDOVER.md` / `SETUP_GUIDE.md`.*

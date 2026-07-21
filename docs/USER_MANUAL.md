# Jewel Factory — User Manual (सरल गाइड)

Ye manual koi bhi (non-technical person bhi) padh ke poora system chala sake — isi
tarah likha gaya hai. Har role, uska kaam, login credentials, aur step-by-step
kaam sab niche hai.

> **Ek line me:** Jewel Factory ek **B2B gold-jewellery ordering platform** hai jo
> **ek Manufacturer** ko uske **Retailer network** aur unke **in-store customers**
> se jodta hai — **koi price kahin nahi dikhti** (sirf gold ka business) aur
> **customer ki personal detail manufacturer tak kabhi nahi jaati**.

---

## 1. Ye system kyun banaya gaya (Purpose)

Purane tareeke me har jeweller apna alag hisaab rakhta tha — orders phone/WhatsApp
pe, koi tracking nahi, aur bade network me confusion. Jewel Factory ise ek jagah
laata hai:

- **Manufacturer** (factory) ka ek hi catalog — sabhi retailers wahi dekhte hain.
- **Retailer** (shop-owner company) apne kai **Stores (branches)** chala sakta hai.
- Har Store ka **Store Manager** customer ke saamne kaam karta hai (kiosk pe order,
  try-on, custom design).
- Sab orders **Retailer (Head Office)** ke paas approval ke liye jaate hain,
  phir manufacturer ke paas — poori tracking ke saath.

**Design ke 4 pakke niyam (bahut important):**

1. **Price kahin nahi dikhti** — gold-only business hai, keemat roz badalti hai.
2. **Customer ki personal detail (naam/phone) manufacturer tak nahi jaati** — order
   me sirf product + quantity + ek "requirement note" jaata hai.
3. **Manufacturer hamesha Retailer ke fixed Head Office address pe hi bhejta hai** —
   kisi branch ya customer ke ghar nahi. Retailer (Head Office) wahaan se branches me baantta hai.
4. **Har design ka apne aap number banta hai** — `JF-0001`, `JF-0002`… (manual nahi).

---

## 2. System me kaun-kaun hai (4 log)

| # | Role | Ye kaun hai | Kaam ek line me |
|---|------|-------------|-----------------|
| 1 | **Manufacturer** | Factory / admin | Catalog banata hai, retailers approve karta hai, orders bhejta hai |
| 2 | **Retailer** (Store Owner / Head Office) | Jeweller company ka maalik | Apne Stores (branches) + staff banata hai, restock order karta hai, **sab orders approve karta hai + Store Managers se chat** |
| 3 | **Store Manager** | Ek shop chalane wala staff | Customer ke saamne kiosk/try-on/order/custom design |
| 4 | **Customer** (walk-in) | Dukaan me aaya grahak | Sirf dekhta hai — koi login nahi, koi detail store nahi hoti |

**Hierarchy:**
`Manufacturer → Retailer → Stores (branches) → Store Managers → Customer`

---

## 3. Login — kaha, kaise (URLs + Credentials)

Sabse pehla page: **home (`/`)** — ye ek branded Jewel Factory landing hai (navbar:
logo · Catalog · About · Login · Register, featured designs, aur ~5 sec baad ek
register-prompt). **Navbar ke "Login" pe click karo** → ek popup khulta hai jisme do
option hote hain: **Retailer** aur **Store Manager**. Apna chuno. (Manufacturer ka
login chhupa hua hai — seedha `/manufacturer` pe jao.) Chaaho to niche wale seedhe
login URLs bhi use kar sakte ho.

| Role | Login page | Demo Email | Demo Password |
|------|-----------|------------|---------------|
| **Manufacturer** | `/manufacturer/login` | `admin@atjewellers.com` | `manufacturer123` |
| **Retailer** (owner / Head Office) | `/store/login` | `store@demo.com` | `store123` |
| **Store Manager** | `/store-manager/login` | *(banana padega — niche §7)* | *(jo banate waqt set karo)* |

> **Zaroori notes:**
> - Ye demo credentials sirf tab bante hain jab system fresh install pe seed hota
>   hai. **Manufacturer hamesha banta hai**; Retailer sirf demo mode
>   (`SEED_DEMO_STORE=true`) me. Live client ke liye password **turant badlo**.
> - **Store Manager ka koi default account nahi** — use Retailer
>   banata hai (§7 dekho).
> - Password field me **dot (••••)** dikhte hain; aankh 👁 icon se dekh sakte ho.
> - Galat password pe error dikhega aur button turant free ho jaata hai — sahi
>   daal ke dobara try karo.
> - **Password bhool gaye?** Login page pe "Forgot password?" link se reset email
>   aata hai.
> - Retailer, Store Manager aur Manufacturer ke full-page login ek hi responsive
>   portal layout use karte hain: desktop/tablet pe do panels aur mobile pe ek
>   clean panel. Login form beech me rehta hai. Retailer registration me lamba
>   form sirf right panel ke andar scroll hota hai; card ke bahar overflow nahi
>   karta.

---

## 4. Har Role ka poora kaam (menu-wise)

### 4.1 Manufacturer (`/manufacturer/…`)
Factory/admin. Ye dekhta/karta hai:

- **Dashboard** — catalog, orders, retailers ka overview.
- **Catalog** — designs add/edit karo (gold only, **no price**, number auto `JF-XXXX`).
  - *Design add karne ka tarika §8 me.*
- **B2B Orders** — retailers ke restock orders (kis retailer se aaya dikhta hai).
- **Kiosk Orders** — dukaan ke customers ke orders (kis retailer/branch se).
- **Custom Designs** — customer ke special design orders (sirf specs, no customer data).
- **Retailers** — approved retailers manage karo (naam/email/phone edit, password reset, delete).
- **Retailer Registrations** — naye retailer ke sign-up **Approve / Reject** karo.

**Kya NAHI dikhta:** customer ka naam/phone/ghar ka address — kuch bhi nahi. Sirf
retailer ka naam, branch ka naam, requirement note, aur retailer ka Head Office ship address.

### 4.2 Retailer / Store Owner / Head Office (`/store/…`)
Company ka maalik — **ye hi Head Office hai**. Poora menu dikhta hai, aur ye khud
**sab approvals + chat** bhi sambhalta hai (jo pehle alag "HO Manager" karta tha):

- **Dashboard**, **Pending Approvals**, **B2B Orders**, **Kiosk Orders**, **Custom Designs**
- **Manufacturer Catalog** — poora catalog dekho + restock order banao.
- **Intelligence / Analytics** — demand/insights.
- **Stores (Branches)** — apne shops + Store Managers banao (§7).
- **Retailer Profile** — company detail + fixed delivery (Head Office) address.
- **Settings** — company settings.

**Approvals + chat (pehle HO Manager karta tha, ab Retailer khud):** har branch ke
saare orders **approve/reject** karna, requirement note edit karna, aur Store
Managers se **chat** karna. Manufacturer ke paas order tabhi jaata hai jab
Retailer (Head Office) approve karta hai.

### 4.3 Store Manager (`/store-manager/…`)
Ek shop chalane wala staff. Customer ke saamne isi device pe kaam karta hai:

- **Home**
- **Catalog** — customer ko designs dikhao, order me daalo.
- **Try-On** — AR se gehna face/neck pe laga ke dikhao.
- **Search** — photo se milta-julta design dhoondho.
- **Custom Design** — customer ka special order form (image + specs + note).
- **Restock** — manufacturer se stock mangao (**PIN se khulta hai**).
- **My Orders** — apne bheje orders track karo (search + status + date filter),
  Head Office (Retailer) se chat karo, aur pahunchne pe **Mark Completed** karo.

**Store Manager ko manufacturer ka detailed status nahi dikhta** — sirf:
Pending / Approved by Head Office / Rejected / Completed.

### 4.4 Customer (walk-in — koi login nahi)
Store Manager ke device pe browse karta hai: catalog dekhna, AR try-on, photo
search, custom design maangna. **Uski koi bhi personal detail system me save nahi
hoti** — Store Manager use apne paas rakhta hai; system me sirf "requirement note"
jaata hai.

---

## 5. Orders kaise chalte hain (3 flows)

Teenon orders ka **ek hi rasta**: Store Manager banata hai → **Retailer (Head
Office) approve karta hai** → Manufacturer ke paas jaata hai → Manufacturer Retailer
ke Head Office address pe bhejta hai → Head Office branch ko deta hai → Store Manager
**Mark Completed** karta hai.

### (a) Kiosk order (customer catalog se kharidta hai)
1. Store Manager kiosk pe order banata hai: products + quantity + requirement note
   (customer ka naam/phone nahi).
2. Retailer (Head Office) ko dikhta hai "Store X ne bheja" — note edit kar sakta hai — phir **Approve**.
3. Manufacturer ko milta hai (note + branch ka naam; koi customer data nahi).
4. Manufacturer Retailer ke Head Office address pe bhejta hai; Head Office branch ko deta hai.
5. Beech me Head Office ↔ Store Manager **chat** kar sakte hain; pahunchne pe Store Manager
   **Mark Completed**.

### (b) Custom design request (customer ko special piece chahiye)
1. Store Manager `Custom Design` form bharta hai: category, weight, purity, note,
   reference image (customer detail nahi).
2. Retailer (Head Office) **Approve & Forward** karta hai (chat bhi kar sakta hai).
3. Manufacturer ko sanitized order milta hai (`CD-xxxx`), koi customer data nahi.
4. Manufacturer Head Office address pe bhejta hai; Store Manager track + **Mark Completed**.
   (Full manufacturer status — confirmed/shipped/tracking — sirf Retailer (Head Office) ko dikhta hai.)

### (c) Restock / B2B order (shop stock mangata hai)
1. Store Manager `Restock` kholta hai → **branch ka Restock PIN** daalta hai.
2. Manufacturer catalog se order karta hai.
3. Retailer (Head Office) approve karta hai.
4. Manufacturer Head Office address pe bhejta hai; **Delivered** hote hi stock retailer ke
   product list me aa jaata hai.
5. Chat + Mark Completed same.

> **Requirement note** = customer ki demand (size, engraving, kab tak chahiye).
> Store Manager likhta hai, Retailer (Head Office) bhi edit kar sakta hai, aur ye
> manufacturer tak jaata hai. **Isme kabhi personal detail mat likho.**

---

## 6. Orders dhoondhna / filter karna (sab jagah)

Har order list pe (Retailer/Head Office, Manufacturer, Store Manager — sab):

- 🔍 **Order-ID search** — order number type karo (jaise `GK-…`, `B2B-…`, `CD-…`).
- **Status filter** — Pending / Approved / Shipped / Completed… dropdown.
- **From / To date** — kis date range ke orders chahiye.
- **Retailer (Head Office)** ke paas extra: **Store (branch) wise** filter (kaunsa order kis Store se aaya).
- **Manufacturer** ke paas extra: **Retailer wise** filter (kaunsa order kis Retailer se aaya).
- Order detail me: Retailer (Head Office) ko **branch** dikhta hai, Manufacturer ko **retailer** dikhta hai.

---

## 7. Naye log kaise banaye (User creation)

### Retailer khud register kaise kare — `/store/register`
Retailer ye form bharta hai (3 hisse):
1. **Business Details:** Business name, Owner name, Owner phone, Business email
   (login), Password (min 6), Logo URL (optional).
2. **Fixed Delivery Address (Head Office address):** Street, City, State, Pincode,
   Landmark (optional) — **yahi pe manufacturer bhejega**.
3. **First Store Manager:** Manager name, email aur password; phone optional.

Desktop/tablet pe left side partnership ka short overview rehta hai aur right
side application form. Scroll sirf right panel ke andar hota hai, isliye poora
rounded frame screen me contained rehta hai. Mobile pe form single-column ho
jaata hai.

Registration se **Retailer account** ban jaata hai (yahi login `/store/login` pe
chalega, aur yahi Head Office ka kaam — approvals + chat — sambhalta hai).

Submit ke baad message: "Registration submitted — approval ke baad access milega."
Phir **Manufacturer approve karega** (niche).

### Manufacturer retailer ko approve kare — `/manufacturer/store-registrations`
Pending retailers ki list dikhti hai (naam, email, city, owner, address). Har row
pe **Approve** ya **Reject**. Approve karte hi retailer ko access mil jaata hai aur
catalog se link ho jaata hai.

### Retailer Stores (branches) + Store Managers banaye — `/store/branches`
- **Add a Store (branch):** Store name*, phone, street, city, state, pincode,
  landmark. Har branch ka **Restock PIN** (min 4 digit) bhi set kar sakte ho.
- **Add Store Managers** (store expand karke): Name*, phone, Email*, Password (min 6)*.
  Active/inactive toggle, password reset, remove — sab yahaan.

---

## 8. Manufacturer design kaise add kare — `/manufacturer/catalog` → New

**Manual (hamesha available):**
1. Category / Sub-category / Weight / Purity chuno.
2. **Design Name** likho.
3. **Catalog photo** upload karo (ek ya zyada).
4. Optional: **Try-On PNG** (transparent) upload karo (AR ke liye).
5. Status **Active** (visible) rakho → **Save**. Number `JF-XXXX` apne aap.

**Generate with AI (optional — tabhi dikhta hai jab AI service configured ho):**
1. Category/Weight/Purity chuno.
2. Ek **raw phone photo** upload karo (temporary, save nahi hoti).
3. **Generate** dabao → AI apne aap bhar dega: Design Name + Description +
   sundar catalog image + transparent try-on PNG.
4. Kuch bhi edit kar sakte ho, ya custom instruction ke saath regenerate.
5. Review karke **Save**.

> Generated catalog/try-on image pe **click** karo to bada (zoom) dikhta hai.
> AI feature ko OpenAI credit chahiye — agar "generate" fail ho to billing check karo.

---

## 9. AR Try-On + Visual Search (Store Manager)

- **Try-On:** `Try-On` menu — camera on → list se piece chuno → face/neck pe
  overlay dikhta hai. Catalog ya Search se seedha "Try On" button bhi hai (wahi
  piece auto-select ho jaata hai), aur "← Back" se wahi page pe wapas.
- **Search:** `Search` → customer ki pasand ki koi photo upload karo → milte-julte
  catalog designs aa jaate hain → kisi pe click → detail + "Order from Catalog".

> **Mobile camera note:** Abhi `Upload photo` phone par rear camera seedha kholta
> hai. Ye in-store camera-first use ke liye expected behavior hai, error nahi.
> Kai phones par isi control se purani gallery/file choose karne ka option nahi
> milega. Dono choices chahiye to UI me alag **Take photo** aur **Choose photo**
> actions dene chahiye.

---

## 10. Chat (Head Office ↔ Store Manager)

- Har order pe ek **Message** thread hai — dono taraf baat kar sakte hain.
- **Store Manager:** My Orders me "Message Head Office".
- **Retailer (Head Office):** Pending Approvals **aur** Custom Designs pe "Message".
- Ye chat sirf Head Office (Retailer) aur Store Manager ke beech — **customer/manufacturer ko nahi dikhta**.

---

## 11. Roz ka istemaal — quick checklist

**Store Manager (dukaan me):**
- Customer aaye → Catalog/Try-On/Search dikhao → order banao (note likho) → bhej do.
- My Orders me status dekhte raho; maal aane pe **Mark Completed**.
- Custom chahiye to Custom Design form; stock kam to Restock (PIN se).

**Retailer / Head Office (office me):**
- Pending Approvals roz check karo → note theek karo → **Approve** → manufacturer ko jaayega.
- Store Managers ke sawaal chat pe jawab do.
- Stores (branches), Store Managers, restock aur Retailer Profile bhi yahin se sambhalo.

**Manufacturer (factory):**
- Naye Retailer Registrations approve karo.
- Kiosk/B2B/Custom orders dekho → status aage badhao (Confirmed → Packed → Shipped →
  Delivered). Retailer ke Head Office address pe bhejo.
- Catalog me naye design add karte raho.

---

## 12. Aksar poochhe jaane wale (FAQ)

- **Price kyun nahi dikhti?** Gold roz badalta hai; keemat store apne hisaab se
  customer ko batata hai. System sirf design + order sambhalta hai.
- **Customer ka naam/phone kaha jaata hai?** Kahin nahi (system me). Store Manager
  apne paas rakhta hai. System me sirf requirement note.
- **Manufacturer maal kaha bhejta hai?** Hamesha Retailer ke fixed Head Office address pe.
- **Store Manager account kaise bane?** Retailer `Stores (Branches)`
  page se banata hai.
- **Login button ghoomta hi reh gaya?** Ab fix hai — galat password pe turant free
  ho jaata hai; sahi daalo.
- **"Generate with AI" nahi dikh raha?** Wo optional hai — tabhi aata hai jab AI
  service set ho. Manual add hamesha chalega.

---

*Powered by Jewel Factory. Ye manual features ke saath update hota rahega — technical
detail ke liye `flow.md`, setup ke liye `HANDOVER.md` / `SETUP_GUIDE.md`.*

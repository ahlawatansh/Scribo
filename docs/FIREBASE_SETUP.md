# KisanKhata — Free Firebase setup (no terminal)

Project: **shyam-agricultural-store**

This app runs on Firebase’s **Spark (free) plan**. You do **not** need to pay or upgrade to Blaze for normal shop + farmer use.

---

## Free vs paid — what you need

| Feature | Plan | Cost for a small shop |
|---------|------|------------------------|
| Login (Email / Google) | Spark ✅ | Free |
| Firestore database | Spark ✅ | Free within daily limits |
| Security rules | Spark ✅ | Free |
| Hosting (web app URL) | Spark ✅ | Free |
| Cloud Functions | Blaze only | **Not required** for this app |

**Do not upgrade to Blaze** unless you later want online Razorpay payments. Udhar, farmers, and transactions work on the free plan.

---

## Step 1 — Stay on the free plan

1. Open [Firebase Console](https://console.firebase.google.com/) → **shyam-agricultural-store**
2. Click the **gear** → **Usage and billing**
3. Confirm plan is **Spark (No-cost)**  
4. If it asks to upgrade, choose **Not now** / stay on Spark

---

## Step 2 — Authentication

1. **Build → Authentication → Get started**
2. **Sign-in method**:
   - Enable **Email/Password**
   - Enable **Google** (add a support email when asked)
3. **Settings → Authorized domains** — add:
   - `localhost` (optional, for local testing)
   - `shyam-agricultural-store.web.app` (after Hosting is set up)
   - `shyam-agricultural-store.firebaseapp.com`

---

## Step 3 — Create shop owner

1. **Authentication → Users → Add user**
2. Email: your shop email (example: `shop@example.com`)
3. Password: choose a strong password  
4. Remember this email for the next step.

---

## Step 4 — Firestore shop settings

1. **Build → Firestore Database → Data**
2. Create collection `settings`, document id `shop`
3. Add fields:

| Field | Type | Example |
|-------|------|---------|
| `ownerEmail` | string | same email as Step 3 |
| `shopName` | string | `SEA Store` |
| `currentSeason` | string | `2025_kharif` |

4. Save.

---

## Step 5 — Publish security rules

1. **Firestore Database → Rules**
2. Copy all text from the `firestore.rules` file in this project folder on your Mac  
   (`Desktop/Khata/firestore.rules`)
3. Paste into the Rules editor → **Publish**

---

## Step 6 — Create indexes (one-time)

1. **Firestore Database → Indexes → Composite**
2. Add these if they are not already there:

**Index 1**
- Collection: `transactions`
- Fields: `farmerId` Ascending, `createdAt` Descending

**Index 2**
- Collection: `transactions`
- Fields: `type` Ascending, `status` Ascending, `returnDate` Ascending

3. Wait until each index shows **Enabled** (can take a few minutes).

If you open the app and see a “create index” link in the browser, click it — Firebase will pre-fill the index for you.

---

## Step 7 — Open the app (no terminal)

### Option A — Firebase Hosting (recommended)

1. **Build → Hosting → Get started**
2. Choose **Connect to GitHub** (or upload build files if you already have a `dist` folder)
3. After deploy, open your site URL, for example:
   - `https://shyam-agricultural-store.web.app`

No terminal needed on your Mac after Hosting is connected.

### Option B — Use Firebase Console only for data; open app elsewhere

If Hosting is not set up yet, you can still configure Auth + Firestore in the Console (Steps 1–6). Someone with the project files would need to publish Hosting once — or use Option A with GitHub.

---

## Step 8 — How to use the app

### Shop login

1. Open your app URL (or Hosting URL)
2. Choose **Shop**
3. Security key: `123456`
4. Sign in with the shop email + password from Step 3

### Farmer login (see shop transactions)

**Important:** Shop must add the farmer’s mobile first.

1. Shop → **Farmers** → add farmer with **10-digit mobile**
2. Shop → add a transaction for that farmer (Paid now or Credit)
3. Farmer → **Login** → **Farmer** tab
4. Sign in with Email or Google
5. Enter the **same mobile number** and name → **Continue**
6. Open **My Transactions** — shop entries should appear

---

## What you do NOT need

- ❌ Terminal / `firebase deploy`
- ❌ Blaze (paid) plan for normal use
- ❌ Cloud Functions
- ❌ Phone OTP / SMS
- ❌ Razorpay (optional later)

---

## Troubleshooting

| Problem | Fix in Firebase Console |
|---------|-------------------------|
| “Shop settings missing” | Create `settings/shop` with `ownerEmail` (Step 4) |
| “Not the shop owner” | `ownerEmail` must match login email exactly |
| “Permission denied” | Republish rules (Step 5) |
| Farmer sees no transactions | Shop must add farmer mobile under **Farmers**, then add a transaction; farmer must log in with that same mobile |
| Index error | Create indexes (Step 6) and wait until Enabled |
| Google login fails | Enable Google provider + add your site domain under Authorized domains |

---

## Billing safety tip

In **Usage and billing**, you can set a **budget alert** at ₹0 / $0 so Google emails you if anything ever tries to charge. On Spark plan, Cloud Functions cannot run, so you will not accidentally use paid backend features.

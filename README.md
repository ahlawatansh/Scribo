<div align="center">

# Scribo — Digital Ledger & Credit Operating System

**A modern, cross-platform digital ledger ecosystem uniting React 18, Vite, Tailwind CSS, Firebase Firestore, and Capacitor to modernize credit (Udhar) tracking, automated PDF billing, and real-time customer balances.**

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646C9A.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore_12-FFCA28.svg?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.3-119EFF.svg?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Android](https://img.shields.io/badge/Android-APK_Build-3DDC84.svg?logo=android&logoColor=white)](https://developer.android.com/)

### 🌐 Live Web Application: https://sscribo.vercel.app/

### 📱 Android Application: https://mega.nz/file/yQcDzKDQ#bWdNT267zJquN1b_uHXCfMqprz-awNt0fupewes-SQQ

</div>

---

## What it is

In small scale retail bussinesses, billions of dollars in daily commerce still rely on informal paper credit (*"Khata"*). Handwritten ledgers inevitably suffer from arithmetic discrepancies, misplaced receipts, uncollected receivables, and zero visibility for customers and farmers who often have no reliable way to verify their running balance until harvesting season ends.

**Scribo** replaces paper books with an immutable, synchronized, mobile-first ledger operating system. Built with a dual-portal architecture, Scribo provides:

1. **The Admin Dashboard**: A rapid point-of-sale workflow for logging transactions, monitoring credit (Udhar) vs. cash collections, tracking overdue debt aging, calculating customer creditworthiness, and issuing automated invoices.
2. **Customer Portal**: A lightweight, real-time portal where customers verify their live balance, inspect line-item transaction histories, download branded receipts, and settle balances.

The platform bridges high-performance web engineering with native mobile capabilities: running as an ultra-fast Progressive Web App (PWA) in the browser and as a native Android APK compiled through Capacitor with hardware notifications and native Google Authentication.

---

## Features

- **Dual-Portal Role Architecture** — Clear boundary isolation between merchant administrative operations and customer ledger inspection with PIN-gated merchant access and mobile-verified customer access.
- **Real-Time Credit System** — Sub-second ledger balancing that tracks credit advances, partial settlements, direct cash purchases, and running debt totals without database lock contention.
- **Client-Side PDF Receipt Generator** — On-the-fly generation of styled, itemized invoice receipts rendered client-side using `jsPDF` within ~40ms.
- **Direct WhatsApp Ledger Bot & Sharing** — Automated composition of WhatsApp messages with customer details and deep links to send instant receipts directly to the customer's phone number without third-party messaging costs.
- **Dynamic Credit Scoring & Seasonal Analysis** — Algorithmic assessment of customer repayment turnaround times and seasonal financial health across Indian crop cycles (Kharif, Rabi, and Zaid).
- **Zero-Cost Cloudflare FCM Push Relay** — Serverless edge worker on Cloudflare that generates signed Google OAuth tokens to trigger Firebase Cloud Messaging (FCM) v1 alerts on Spark (free) tiers.
- **Offline PWA & Native Android** — Service worker caching via Workbox for offline operational reliability alongside a production-ready Capacitor Android Studio container.

---

## Web vs. Android: Understanding the Architecture

For developers and beginners exploring this repository, Scribo maintains a strict separation of concerns between its **Web Frontend** and its **Android Native Container**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        SCRIBO PLATFORM LAYERS                         │
├──────────────────────────────────┬─────────────────────────────────────┤
│        🌐 WEB APPLICATION        │         📱 ANDROID APPLICATION      │
│     (Browser & PWA Clients)      │      (Native Android Studio APK)    │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • Codebase: `src/`               │ • Codebase: `android/`              │
│ • Stack: React 18, Vite, Tailwind│ • Runtime: Android Gradle + WebView │
│ • Deploy: Vercel / Firebase Host │ • Output: `app-debug.apk` / Play AAB│
│ • Storage: IndexedDB + CacheAPI  │ • Native: FCM Push, Local Alarms    │
│ • Auth: Firebase Web Popup/OAuth │ • Auth: Capacitor Native Google SDK │
└──────────────────────────────────┴─────────────────────────────────────┘
                                   │
               Capacitor Bridge (`npx cap sync android`)
               Copies compiled `dist/` into Android Assets
                                   ▼
          ┌─────────────────────────────────────────────────┐
          │ Shared Cloud Engine: Firebase Firestore NoSQL   │
          │ Auth, Rules, and Cloudflare FCM Push Relay      │
          └─────────────────────────────────────────────────┘
```

### 1. The Web Layer (`src/`)
Contains all user interface components, client logic, and data layer integrations. It compiles via Vite into a single-page application (`dist/`). Anyone visiting [https://sscribo.vercel.app/](https://sscribo.vercel.app/) runs this web client directly in their browser.

### 2. The Android Layer (`android/`)
A complete, standalone Android Studio project. It does not reinvent the UI; instead, it uses **Capacitor** as a native bridge. When you run `npm run cap:sync`, Vite builds the web app and copies the static assets into `android/app/src/main/assets/public/`. The Android shell wraps these assets inside an optimized native Android WebView and bridges native hardware APIs:
- `@capacitor-firebase/authentication`: Native Google sign-in dialog avoiding WebView OAuth blocks.
- `@capacitor/push-notifications` & `@capacitor/local-notifications`: Native system tray notifications.

---


## How the Ledger System Works

To understand how Scribo maintains accurate financial state across distributed web and mobile clients, here is the lifecycle of a transaction from input to ledger reconciliation:

```text
[ Merchant POS Dashboard ]
            │
            ▼ (Validate Items, Quantities, Prices & Rates)
[ Transaction Form Validator ]
            │
            ├───► [ Direct Cash Paid ] ───► Total Paid += Amount (Udhar Unchanged)
            │
            └───► [ Credit / Udhar ]   ───► Total Outstanding += Amount
                        │
                        ▼
[ Client-Side PDF Invoice Engine ] ───► Generates Blob & Native Share Sheet
                        │
                        ▼ (Atomic Write)
[ Firestore `transactions` Collection ]
                        │
       ┌────────────────┴────────────────┐
       ▼                                 ▼
[ Real-Time Snapshot Listener ]   [ Cloudflare Worker Edge Relay ]
(Instant UI Update on Devices)                   │
                                                 ▼ (FCM HTTP v1 Protocol)
                                  [ Android System Tray Push Alert ]
```

### 1. Dual-Role Authentication & Access Control
Scribo protects merchant data while making customer accounts frictionless:
- **Admin Authentication**: Uses Firebase Email/Password or Google OAuth, coupled with a server-validated security PIN. Only authenticated merchants with verified emails matching `settings/shop.ownerEmail` possess full write and delete permissions over the store's records.
- **Customer Authentication**: Customers log in via Google or Email and provide their registered 10-digit mobile number. Scribo's security logic performs a reverse lookup (`mobile_lookup` & `email_lookup`), linking their login identity (`authUid`) to the merchant's customer record without exposing other customers' data.


### 2. Balance & Financial Invariant Formulas
Every transaction computes running financial invariants:

$$\text{Grand Total} = \sum_{i=1}^{n} (\text{Quantity}_i \times \text{Rate}_i)$$

For a transaction marked as **Credit (Udhar)**:
$$\text{Remaining Dues} = \text{Grand Total} - \text{Advance Paid}$$
$$\text{Customer Total Outstanding} = \sum \text{Remaining Dues of Pending Transactions}$$

When a repayment or dues clearance is recorded:
$$\text{New Outstanding} = \max(0, \, \text{Previous Outstanding} - \text{Settled Amount})$$


### 3. Credit Scoring & Risk Heuristic
Scribo calculates a dynamic credit score (from 300 to 900) for every customer based on repayment frequency and debt aging:

$$\text{Turnaround Days} = \frac{1}{m} \sum_{j=1}^{m} (\text{ClearedDate}_j - \text{CreatedDate}_j)$$

$$\text{Repayment Ratio} = \frac{\text{Total Amount Repaid}}{\max(1, \text{Total Udhar Granted})}$$

Customers with a high repayment ratio and low average turnaround days receive top tier scores ($>750$) and higher automated credit limit suggestions.


### 4. Client-Side PDF Synthesis Pipeline
Rather than relying on resource-intensive backend PDF rendering engines, Scribo renders itemized invoices directly in the browser's JavaScript runtime:
1. `jsPDF` creates an in-memory vector canvas conforming to standardized A4 invoice typography.
2. Store branding, invoice number, timestamps, farmer contact details, and itemized rows are drawn mathematically.
3. The generated array buffer is converted to a local Blob and shared natively via the Web Share API or provided via a direct download link.

---


## System Metrics & Performance

| Metric | Measurement / Specification |
|---|---|
| **Vite Bundle Build Time** | ~850 ms (Production Rolldown / ESBuild pipeline) |
| **Client-Side PDF Generation** | ~40 ms per invoice |
| **Firestore Real-Time Latency** | ~120–180 ms across active snapshot listeners |
| **Total Production PWA Footprint** | ~3.4 MB (pre-cached for instant offline boot) |
| **Android Compatibility** | Android 8.0 (API 26) through Android 15+ (API 35) |
| **Push Notification Dispatch** | < 250 ms edge execution via Cloudflare Worker |

---

## Tech Stack

| Domain | Technology | Purpose |
|---|---|---|
| **Web Frontend** | React 18.3, React Router v6 | Component-driven responsive user interface |
| **Build & Tooling** | Vite 8, PostCSS, Autoprefixer | Fast HMR dev server and production bundler |
| **Styling** | Tailwind CSS 3.4, Glassmorphism | Custom design tokens, responsive layouts, modern mobile styling |
| **Mobile Runtime** | Capacitor 8 (Android) | Native Android wrapper, WebView bridge, native plugins |
| **Database & Auth** | Google Firebase Firestore 12 | NoSQL real-time document store and Google/Email authentication |
| **Edge Serverless** | Cloudflare Workers | Free push notification relay signing Google FCM v1 requests |
| **Document Generation** | jsPDF, html2canvas, DOMPurify | Client-side vector PDF generation and sanitized HTML rendering |
| **Hosting & Cloud** | Vercel (Web), Google Play / APK | Production web hosting and native Android application package |

---

## Project Structure

```text
Scribo/
├── android/                        # Native Android Studio Capacitor Project
│   ├── app/
│   │   ├── src/main/               # Android Manifest, Java sources, drawable assets
│   │   │   ├── AndroidManifest.xml # Permissions (Internet, Push, Storage)
│   │   │   ├── java/.../           # MainActivity.java (Capacitor bridge entry)
│   │   │   └── res/                # App icons, splash screens, XML layouts
│   │   ├── build.gradle            # App-level Android build configuration
│   │   └── google-services.json    # Android Firebase configuration file
│   ├── build.gradle                # Top-level Gradle build file
│   └── variables.gradle            # Android SDK and dependency versions
├── docs/                           # Technical Guides & Setup Documentation
│   ├── ANDROID_SETUP.md            # Detailed Android Studio & APK build walkthrough
│   ├── FIREBASE_SETUP.md           # Firestore rules, indexes, and Spark setup
│   └── TEST_REPORT.md              # Historical validation and test coverage log
├── functions/                      # Optional Firebase Cloud Functions
│   ├── index.js                    # Cloud triggers for transactions and notifications
│   └── package.json                # Functions runtime dependencies
├── public/                         # Static Assets & PWA Manifest
│   ├── dark.png                    # Dark mode brand emblem
│   ├── white.png                   # Light mode brand emblem
│   ├── websitelogo.png             # Primary high-res application icon
│   └── manifest.json               # Web App Manifest for PWA installation
├── src/                            # Core Application Source Code
│   ├── components/                 # Reusable UI components
│   │   ├── common/                 # AlertHost, BottomTabBar, ConfirmDialog, Splash
│   │   └── shop/                   # ReceiptDialog, item editors, financial cards
│   ├── context/                    # React Context providers (AuthContext)
│   ├── firebase/                   # Firebase configuration, DB queries, auth helpers
│   │   ├── config.js               # Firebase app initialization
│   │   ├── auth.js                 # Unified Web + Native Google/Email auth bridge
│   │   ├── db.js                   # Firestore CRUD operations and queries
│   │   └── pushNotifications.js    # FCM token registration and listener bindings
│   ├── hooks/                      # Custom hooks (useAuth, useOnlineStatus)
│   ├── layouts/                    # Layout shells (ShopLayout, FarmerLayout, AuthGuard)
│   ├── pages/                      # Application route views
│   │   ├── auth/                   # Login, ForgotPassword, Security Key verification
│   │   ├── farmer/                 # Farmer balance, line transactions, notifications
│   │   └── shop/                   # Dashboard, Udhar list, Farmers, POS, Season report
│   ├── styles/                     # Global CSS and Tailwind directives
│   ├── utils/                      # Pure utilities: PDF generator, WhatsApp, alerts
│   ├── App.jsx                     # Top-level application routing and guards
│   └── main.jsx                    # Application bootstrapping and service worker init
├── capacitor.config.json           # Capacitor configuration (App ID, Name, WebDir)
├── cloudflare-push-relay-worker.js # Standalone Cloudflare Worker for FCM push notifications
├── firestore.rules                 # Production Firestore security rules
├── firestore.indexes.json          # Composite query index definitions
├── package.json                    # Project metadata, scripts, and dependencies
├── tailwind.config.js              # Tailwind theme, typography, and color tokens
├── vite.config.js                  # Vite bundler and PWA plugin configuration
└── README.md                       # Repository master documentation
```

---

## Running it locally

### Track 1: Web Application (Browser & PWA)

**Prerequisites:** Node.js 18+ and npm installed.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ahlawatansh/Scribo.git
   cd Scribo
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   *(Optional: set your Cloudflare Push Relay URL or leave defaults for local testing)*

4. **Run the local development server:**
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5000` (or the port displayed in your terminal).

5. **Build for production:**
   ```bash
   npm run build
   ```
   The production-optimized static files will be placed in the `dist/` directory.

---

### Track 2: Android Application (Capacitor & Android Studio)

**Prerequisites:** Android Studio (Ladybug or newer) with Android SDK Platform 34+, Android SDK Build-Tools, and Java 17+.

1. **Build the Web assets and sync with Android:**
   ```bash
   npm run cap:sync
   ```
   This compiles `dist/` and synchronizes all web code and native plugins into `android/`.

2. **Open the project in Android Studio:**
   ```bash
   npm run cap:open
   ```
   Or open the `android/` directory directly inside Android Studio.

3. **Add Firebase `google-services.json`:**
   Download your `google-services.json` from the Firebase Console (under project `shyam-agricultural-store`, package `com.shyam.agriculturalstore`) and place it here:
   ```text
   android/app/google-services.json
   ```

4. **Build the Debug APK via CLI (No Android Studio GUI required):**
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
   The compiled APK will be generated at:
   ```text
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

5. **Install on a connected Android phone:**
   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

---

## Cloudflare Push Relay (Zero-Cost Push Notifications)

- Scribo provides an open-source serverless relay in `cloudflare-push-relay-worker.js`.

Deployable on **Cloudflare Workers** (free up to 100,000 requests/day):
1. Create a Cloudflare Worker and paste `cloudflare-push-relay-worker.js`.
2. Add worker secret environment variables:
   - `FIREBASE_WEB_API_KEY`: Web API key from Firebase project.
   - `SERVICE_ACCOUNT_JSON`: Service account JSON key with Firebase Admin / FCM access.
   - `SHOP_OWNER_EMAIL`: Merchant email authorized to dispatch pushes.
3. Add the worker URL to your `.env` as `VITE_PUSH_RELAY_URL`.

---


## Database Architecture & Security Model

Scribo structures data around six core collections:

| Collection | Access Scope | Purpose |
|---|---|---|
| `settings/shop` | Read: Any Auth / Write: Restricted | Stores merchant metadata, name, and owner email |
| `farmers` | Read: Merchant or Owner / Write: Controlled | Stores customer demographics, phone numbers, and balances |
| `transactions` | Read: Merchant or Linked Customer | Stores itemized orders, payment statuses, and remaining dues |
| `notifications`| Read: Targeted User / Write: Authenticated | System alerts, payment confirmations, and balance reminders |
| `mobile_lookup`| Read: Authenticated / Write: Strict validation | Links phone numbers to customer account UIDs |
| `pushTokens`   | Read: Owner / Write: Owner | Stores active FCM device registration tokens for push routing |


---

<div align="center">
<sub>Built with precision by <a href="https://github.com/ahlawatansh">Ansh Ahlawat</a> · CSE undergrad, VIT Vellore</sub>
<br>
<sub><a href="https://www.linkedin.com/in/anshahlawat">LinkedIn</a> • <a href="https://github.com/ahlawatansh">GitHub</a> • <a href="https://sscribo.vercel.app/">Live Web App</a></sub>
</div>

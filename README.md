# AfyaPulse — Community Health & Clinic Triage OS

An offline-first clinical operating system for community health promoters and
level-4 clinic teams. Register households, triage vitals against age-banded
thresholds, close ANC/EPI follow-ups and control dispensary stock — **with zero
connectivity** — then ship the same codebase to Vercel and as a sideloadable
Android APK.

Built with React (Vite), Tailwind, Framer Motion, Dexie (IndexedDB) and
Capacitor.

---

## Why it exists

| Field problem | AfyaPulse response |
| --- | --- |
| Paper registers get lost or soaked; records never reach the facility | Every patient, vital, visit and dispensing is written to IndexedDB on the device |
| Missed immunisation and ANC contacts | Kenya EPI + WHO ANC care plans generated at registration, with live countdowns and overdue escalation |
| Clinic stockouts and expired batches discovered too late | Batch-level stock with reorder levels, 30/90-day expiry alerts, cold-chain flags and an auditable ledger |
| Shared phones / borrowed accounts | Explicit role switcher with privilege gating at both the UI and repository layer |
| No signal in outreach sites | App shell cache (service worker) + local database; the APK is fully self-contained |

All demo data (patients, staff, facilities) is fictional.

---

## Feature map

### 1. Triage & patient register
- Intake: name, sex, age (years/months or exact birth date), phone, ward, village,
  care pathway (general / ANC / under-5 / chronic), symptoms, allergies, notes.
- Vitals: BP, temperature, pulse, SpO₂, respiratory rate, weight, height, MUAC.
- **Live triage preview** while typing — adult vs under-5 thresholds, MUAC for
  6–59 months, infant/child/adult pulse bands, BMI for adults.
- Three clinical bands with explanatory flags: **Normal**, **Caution**,
  **Urgent Referral**. Danger signs (convulsions, chest indrawing, unable to
  feed, etc.) force urgent.
- Urgent vitals automatically raise a referral awaiting clinical approval.
- Expandable patient cards: latest vitals, flags, symptoms, upcoming visits,
  visit history (clinical officer only), quick actions.
- Search (name, clinic number, ward, village, phone, symptom), category tabs,
  risk filters, priority/recent/overdue/name sorting.
- Admin-only anonymised epidemiological CSV export.
- Reversible archive view: archived records retain history and can be restored
  by the clinical officer.

### 2. Follow-up & immunisation scheduler
- Auto-generated care plans:
  - **EPI**: birth doses, 6/10/14-week bundles, 6-month vitamin A, 9-month
    measles-rubella + yellow fever, 18-month MR2, 24-month review, with a
    6-month catch-up window for late registrations.
  - **ANC**: WHO 8-contact schedule derived from EDD or gestation.
  - **Chronic**: monthly reviews.
- Countdown labels ("Due in 5 days", "3 weeks overdue"), overdue alerts,
  due-today, next-7-days and closure-rate analytics.
- Mark complete, defer +3/+7/+14 days, reschedule to any date, reopen, delete
  (admin), and add manual visits.
- Field staff can close home visits; deletions stay with the clinical officer.

### 3. Pharmacy & cold chain
- 16 seeded stock lines: batch, expiry, quantity, reorder level, baseline,
  supplier, storage condition (ambient / 2–8 °C / frozen).
- Low-stock, stock-out, near-expiry (≤30 days critical, ≤90 days warning) and
  expired states; urgency-sorted inventory.
- Dispense (patient-linked or walk-in) with atomic stock deduction and ledger
  entry; restock; manual count correction; **expiry override with mandatory
  justification**; all gated to the clinical officer.
- Dispensing log and full movement ledger (restock / dispense / adjustment).
- Cold-chain surveillance panel.

### 4. Settings & APK centre
- Prominent role switcher (Clinical Officer/Admin ↔ CHP).
- Three-mode theme engine: Clinical Teal, Sterile Glass, Night Ward Amber.
- Operator profile per role, haptic toggle, runtime info, privilege matrix.
- Offline storage telemetry (usage/quota, record counts, persistent-storage
  request), JSON backup export/restore, demo reload, full erase.
- Recent audit trail.
- **APK centre**: verifies and serves the compiled Android package, with
  fallback build instructions and PWA install.

---

## Roles & privileges

| Capability | Clinical Officer / Admin | CHP (field) |
| --- | :---: | :---: |
| Register patients, record vitals | ✅ | ✅ |
| Work/close scheduled home visits | ✅ | ✅ |
| View stock availability | ✅ | ✅ |
| Edit identity details / histories | ✅ | — |
| Archive or delete patient records | ✅ | — |
| Dispense, restock, adjust inventory | ✅ | — |
| Override batch expiry | ✅ | — |
| Approve referrals | ✅ | ✅ (raise only) |
| Anonymised epidemiological export | ✅ | — |
| Backup / restore device database | ✅ | — |

Enforced twice: controls are hidden/disabled in the UI **and** repository
mutations call `assertAdmin`, so a stray handler cannot bypass the role.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 18 + Vite 5 |
| Styling | Tailwind 3, custom CSS-variable theme engine, glass utilities, mesh keyframes |
| Motion | Framer Motion (spring `stiffness: 300, damping: 25`) |
| Icons | Lucide React |
| Offline storage | Dexie 4 / IndexedDB, `dexie-react-hooks` live queries |
| Packaging | Capacitor 6 (`@capacitor/android`), PWA manifest + service worker |
| Tests | Vitest + jsdom + fake-indexeddb + Testing Library |

---

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
npm run preview    # serve the built bundle
npm test           # offline DB + UI smoke suite
npm run lint
```

The first launch seeds a fictional Meru County clinic: 12 patients, 25 vitals,
37 care-plan visits, 16 stock lines, dispensing history, referrals and an audit
feed. Use **Settings → Reload demo clinic** at any time, or **Erase all data**
for a blank register.

---

## Offline architecture

```
src/db/db.js        Dexie schema (patients, vitals, schedules, medications,
                    dispensings, adjustments, referrals, prefs, activity)
src/db/repo.js      transactional mutations + role guards + audit logging
src/db/seed.js      deterministic demo clinic
src/lib/triage.js   age-banded decision rules
src/lib/careplan.js EPI / WHO ANC schedule generator
public/sw.js        runtime-cached app shell for cold offline starts
```

- **Writes are local-first.** Every mutation is a Dexie transaction; urgent
  vitals + referral creation happen atomically.
- **Reads are live.** `useLiveQuery` re-renders every screen whenever the local
  store changes (no manual refresh).
- **Nothing is uploaded.** This build has no remote backend; export a JSON
  backup from Settings, or wire your own sync endpoint into `repo.js`.
- **Storage protection.** Settings can request persistent storage so the browser
  will not evict clinical records under pressure.
- **Audit trail.** Patients, vitals, schedules, stock movements, referrals and
  role changes are stamped with actor, role and timestamp.

### Data model (v2)

| Table | Key indexes | Purpose |
| --- | --- | --- |
| `patients` | `++id, &code, name, ward, category, riskLevel, lastVisitAt` | household register |
| `vitals` | `++id, patientId, recordedAt, triageLevel` | append-only observations |
| `schedules` | `++id, patientId, dueDate, status, type` | ANC / EPI / chronic visits |
| `medications` | `++id, name, category, batch, expiryDate, quantity` | dispensary shelf |
| `dispensings` | `++id, medicationId, patientId, dispensedAt` | issue log |
| `adjustments` | `++id, medicationId, at` | stock ledger (restock, dispense, correction) |
| `referrals` | `++id, patientId, status, urgency` | approval workflow |
| `prefs` | `&key` | role, theme, profiles, counters, seed flag |
| `activity` | `++id, at, kind, actor` | local audit feed |

---

## Themes

Theme is a `data-theme` attribute on `<html>` driving RGB CSS variables, mirrored
to `localStorage` so the correct ward lighting paints before React mounts.

| Theme | Canvas | Accent | Intended use |
| --- | --- | --- | --- |
| `clinical` | `#070d10` slate-obsidian | medical teal `#2dd4bf` + cyan | default diagnostic terminal |
| `sterile` | `#eaf4f9` milk glass | sky-blue `#0d7490` | daylight, high readability |
| `amber` | `#140e09` warm charcoal | amber `#f5b042` | night shift, low blue light |

All glass surfaces use `backdrop-blur`, 1px gradient teal edges and animated
mesh gradients defined in `src/styles/index.css` and `tailwind.config.js`.

---

## Android APK

```bash
npm run build        # static bundle
npm run cap:sync     # copy dist + plugins into the native shell
npm run apk:debug    # android/app/build/outputs/apk/debug/app-debug.apk
npm run apk:release  # requires your signing config
```

The generated Android project is committed, so only the Android SDK is needed:

| Piece | Value |
|---|---|
| App id | `ke.afyapulse.clinic` |
| Capacitor | 6 · `@capacitor/android` |
| Compile / target SDK | 34 |
| Minimum SDK | 22 (Android 5.1) |
| Java | 17 |
| Device plugins | `@capacitor/filesystem`, `@capacitor/share` |

`capacitor.config.json` sets `webDir: dist`, an opaque `#070d10` background and
mixed content disabled. The launcher icon (legacy, round and adaptive) and every
splash density are generated from `resources/icon.png`; `android:allowBackup` is
off so clinical data is not swept into cloud device backups — use the in-app JSON
export instead. Exports on Android are written to the app cache and handed to the
system share sheet through the FileSystem + Share plugins.

The layout detects the native shell (`window.Capacitor.isNativePlatform()`) for
safe-area insets and hides the in-app APK download. Navigation is responsive:
handset widths get the native-style bottom tab bar, `lg` and up gets the full
side rail with live counters. `npm run cap:add` is only needed if you delete and
regenerate `android/`.

### Publishing the binary
- **GitHub Actions** (`.github/workflows/android.yml`) builds a debug APK on
  demand and attaches it to a release when you push a `v*` tag.
- Drop the artifact at `public/downloads/afyapulse.apk`, or set
  `VITE_APK_URL` to the release asset URL. The APK centre probes the file, checks
  the `PK` zip header and the content type, and only then shows a working download
  button; otherwise it explains how to build or offers PWA installation.
- `vercel.json` already sends `.apk` files with the Android MIME type and an
  attachment disposition.

---

## Deploy to Vercel

The repo is Vercel-ready:

- `npm run build` → `dist`
- `vercel.json` rewrites all non-API routes to `index.html` (hash routing is
  used, but deep links still resolve)
- Long-lived immutable caching for hashed assets, no-cache for `sw.js`
- `manifest.webmanifest` served as `application/manifest+json`

Point Vercel at the repository, keep the defaults, and deploy. Optional env
vars: `VITE_APK_URL`, `VITE_GITHUB_REPO`.

---

## Tests

`npm test` runs against a real Dexie store in `fake-indexeddb`:

- app boots, seeds the clinic and renders the register
- registering a patient writes the record, issues a clinic number and generates
  follow-ups
- switching to CHP persists the role and hides privileged actions
- all four workspaces mount without crashing
- triage engine: hypertensive crisis, healthy adult, under-5 MUAC + danger signs
- care-plan generator: EPI and ANC
- repository guard rails: CHP blocked from dispensing, expiry overrides and
  archiving; atomic dispense decrements stock and writes a ledger entry;
  over-dispense rejected; restock updates batch and expiry; schedule completion
  stamps the actor; export → erase → import round-trips the whole database

`npm test` runs **15** assertions across two files in a few seconds.

---

## Project structure

```
├── capacitor.config.json          Android shell config
├── vercel.json                    static SPA routing + headers
├── android/                       committed Capacitor project (Gradle, manifest)
├── resources/icon.png              source artwork for launcher/splash assets
├── .github/workflows/android.yml  APK build + release pipeline
├── public/
│   ├── manifest.webmanifest       PWA manifest & shortcuts
│   ├── sw.js                      offline app-shell worker
│   ├── icons/                     app icons (any + maskable)
│   └── downloads/                 drop-point for afyapulse.apk
└── src/
    ├── components/
    │   ├── PatientTriage.jsx      register, filters, referral queue
    │   ├── FollowUpScheduler.jsx  ANC/EPI queue & countdowns
    │   ├── PharmacyTracker.jsx    stock, dispensing, ledger
    │   ├── SettingsPanel.jsx      roles, APK centre, storage
    │   ├── RoleSwitcher.jsx       privilege switch
    │   ├── ThemeToggle.jsx        3-mode theme engine
    │   ├── DownloadAPKModal.jsx   APK verification & build kit
    │   ├── PatientCard.jsx        expandable triage card
    │   ├── ReferralQueue.jsx      approval workflow
    │   ├── Shell.jsx              responsive rail / bottom nav
    │   ├── MeshBackdrop.jsx       animated diagnostic mesh
    │   ├── forms/                 intake, vitals, schedule, stock, dispense
    │   └── ui/                    modal, primitives, fields
    ├── context/AppProvider.jsx    theme, role, toasts, online, PWA install
    ├── db/                        Dexie schema, repo, seed
    ├── lib/                       triage, careplan, dates, csv, pharmacy
    ├── styles/index.css           theme variables + glass utilities
    └── test/                      jsdom smoke suite
```

---

## Clinical notes & limits

- Thresholds follow common IMCI/WHO bands and are configurable in
  `src/lib/triage.js`. They support triage decisions — they do not replace
  clinical judgement.
- The EPI table mirrors Kenya's standard schedule; adjust `EPI_VISITS` if your
  county uses a different formulation.
- There is intentionally **no remote sync or authentication** in this build.
  Add your own encrypted sync endpoint and device enrolment before production
  deployment, and keep paper registers until rollout is validated.
- Backups are unencrypted JSON. Store them on a protected drive.

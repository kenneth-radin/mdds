# Maintenance Decision Support System (MDSS)

Machine-Learning-Assisted Maintenance Decision Support System for motor-based machinery in small-scale manufacturing enterprises.

Core workflow:

```text
Machine profile -> Historical records -> Current problem -> Data-derived analysis
-> Suggestion(s) -> Accept / Modify / Reject -> Actual maintenance -> Outcome
-> Saved as history -> Available for future analyses
```

## Components

| Part | Technology | Location |
| --- | --- | --- |
| Mobile app | React Native, Expo Go, Expo Router, TypeScript | `app/`, `lib/`, `components/` |
| REST API | Node.js, Express, TypeScript | `backend/src` |
| Database | MongoDB Atlas, Mongoose | `backend/src/models` |
| Auth | JWT + bcrypt + expo-secure-store | `backend/src/routes/auth.routes.ts`, `lib/auth.tsx` |
| Analysis / ML | Pure TypeScript: TF-IDF retrieval, statistics, logistic regression | `backend/src/services/`, `backend/src/services/ml/` |

The original Vite web prototype remains in `src/` and `index.html`. The mobile app is the capstone deliverable.

## No hard-coded data

- The database starts empty. Every screen shows a real empty state until the researchers enter data.
- No seeded machines, maintenance records, failures, recommendations, statistics or ML results.
- The analysis engine only uses records that exist in MongoDB. When evidence is below the threshold it returns:
  `Insufficient historical data for reliable analysis.`
- The ML benchmark models are trained offline from the public AI4I 2020 dataset and are **never** written into the
  plant database. Their predictions are labelled as benchmark output, not live sensor monitoring, and each response
  carries the model card's limitations alongside the numbers.

## Analysis engine rules

The analysis engine is a three-layer stack. Every layer is deterministic and every number it reports traces back
to a real record or a documented measurement.

### Layer 1 — retrieval (TF-IDF cosine similarity)

Minimum evidence: **3 comparable historical records** (maintenance records, failure records, or completed cases)
whose problem/symptom text matches the current problem.

Comparable records are ranked with **TF-IDF weighted cosine similarity** (`backend/src/services/ml/tfidf.ts`),
built over the machine's own record set. Plain token overlap (Jaccard) was replaced because a maintenance corpus
is full of low-information verbs — *replaced*, *checked*, *inspected* — that appear in almost every record, so
overlap scores two unrelated jobs as similar merely because both used the word "replaced". TF-IDF down-weights
terms common across the corpus and up-weights discriminative ones (*spindle*, *chatter*, *coolant*), which is
what actually separates one failure mode from another.

The method name is returned to the client in `dataUsed` as
`similarity method: TF-IDF weighted cosine similarity (Layer 1)`, so a reader never has to guess how the
evidence was retrieved. Retrieval is pure TypeScript with zero dependencies and no randomness: the same history
and the same problem always produce the same ranking.

### Layer 2 — statistics

Statistics (MTBF, MTTR, average maintenance interval, average downtime, average cost, failure modes, common
parts, common actions) are aggregated from real records.

### Layer 3 — trained benchmark classifiers

`backend/src/services/ml/` holds a from-scratch logistic-regression implementation
(`logisticRegression.ts`) trained on the **AI4I 2020 Predictive Maintenance Dataset** in 5-fold stratified
cross-validation. Nothing is downloaded at runtime and no third-party ML service is called.

| Script | Purpose |
| --- | --- |
| `npm run ml:train` | Trains the six benchmark classifiers and writes model cards + weights to `backend/data/models/` |
| `npm run ml:verify` | Re-checks the persisted cards against the training report |
| `npm run ml:check` | Live HTTP verification of the ML endpoints (see below) |

Six models are registered — `ai4i-machine-failure` plus one per failure mode (TWF, HDF, PWF, OSF, RNF). Each
carries a **model card**: the dataset and its licence, `synthetic: true`, exact features, the evaluation method,
per-class precision/recall/F1, the full confusion matrix, the majority-class baseline it must beat, and an
explicit list of limitations. A model card with `status: 'not-trained'` is a first-class result, not an error —
it is how the system says "I do not have enough evidence yet" instead of inventing an answer.

Why accuracy alone is never reported on this dataset:

```text
ai4i-machine-failure   majority-class baseline 96.61%
ai4i-twf               majority-class baseline 99.54%
ai4i-hdf               majority-class baseline 98.85%
ai4i-pwf               majority-class baseline 99.05%
ai4i-osf               majority-class baseline 99.02%
ai4i-rnf               majority-class baseline 99.81%
```

A model that always answered "no failure" would already score 96.61% accuracy and catch nothing. The
classifiers are therefore trained with **balanced class weights**: they deliberately score *below* that
baseline because they trade specificity for recall, so rare failures are surfaced rather than ignored. They are
a screening tool that flags candidates for inspection, not a confirmatory test.

Each suggestion contains only real evidence:

- `recommendedAction` - taken from actual historical records
- `rationale` - number of comparable records, average similarity, related failure modes, average recorded downtime
- `parts`, `expectedDowntimeHours` - computed from those same records
- `supportCount`, `sourceRecordIds` - the exact database records used
- `confidence` - derived from evidence volume and similarity, never random

## Setup

### 1. Backend

```powershell
Copy-Item backend/.env.example backend/.env
# edit backend/.env with your Atlas URI and a strong JWT secret
cd backend
npm install
npm run dev
```

`backend/.env`:

```env
PORT=4000
MONGODB_URI=mongodb+srv://<db_user>:<db_password>@<cluster_host>/mdss?retryWrites=true&w=majority
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
```

Atlas requirements: allow your current IP in **Network Access** and give the database user read/write access.
The API listens on `0.0.0.0:4000` so a phone on the same Wi-Fi can reach it.

Health check: `http://localhost:4000/api/health` returns `{"status":"ok","database":"connected"}`.

### 2. Mobile app (Expo Go)

```powershell
# root .env -> an address your phone can reach
EXPO_PUBLIC_API_URL=http://192.168.x.x:4000

npm run expo:start     # same Wi-Fi
npm run expo:tunnel    # Expo tunnel (Metro bundler only)
```

Open Expo Go on the Android phone and scan the QR code.

**Network note:** the Expo tunnel forwards only the Metro bundler, not your API. For a phone on another network,
publish the backend separately — the easiest option is Render (see below) — set
`EXPO_PUBLIC_API_URL=https://mdds.onrender.com`, then restart Expo.

The first registration on an empty database becomes the administrator; later accounts default to technician.

### 3. Optional: original web prototype

```powershell
npm install
npm run dev     # http://localhost:5173
```

## Deploy on Render

Two supported setups — the deployed service uses option A:

**Option A: Docker environment (what `mdds.onrender.com` uses)**

1. Push this repository to GitHub.
2. Render dashboard → **New → Web Service** → connect the repo.
3. Environment: **Docker** (Render detects the root [`Dockerfile`](Dockerfile), which builds only
   `backend/`: `npm ci` → `tsc` → `node dist/server.js`).
4. Set the environment variables below and deploy.

**Option B: Native environment + blueprint**

The repo also ships a [`render.yaml`](render.yaml) blueprint (root dir `backend`, health check
`/api/health`) usable via Render → **New → Blueprint**, or configure the native service manually:

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm run start` |
| Health Check Path | `/api/health` |

**Environment variables** (service → Environment tab; `PORT` is injected by Render — do not set it):

| Key | Value |
| --- | --- |
| `MONGODB_URI` | your Atlas connection string, e.g. `mongodb+srv://user:pass@cluster/mdss?retryWrites=true&w=majority` |
| `JWT_SECRET` | long random hex string |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | `*` |

**MongoDB Atlas**: Network Access must include Render's IPs (e.g. `0.0.0.0/0` — Render egress IPs
are dynamic), and ideally a dedicated least-privilege database user for Render.

**Verify the deploy**: `https://mdds.onrender.com/api/health` must return
`{"status":"ok","database":"connected"}`.

Then point the mobile app at the deployed API:

```powershell
# root .env
EXPO_PUBLIC_API_URL=https://mdds.onrender.com

# restart Expo so the value is bundled into the app, then rescan the QR code
npm run expo:start
```

**Caveats**

- Render free web services spin down after ~15 minutes of inactivity; the first request after idle takes
  roughly 30–50 seconds to wake the instance. Subsequent requests are normal speed.
- Never run `backend/scripts/e2e-check.cjs` against the production URI — it drops the database it connects to.
- The legacy Vite prototype in `src/` is local-only; hosting it on Render would require a separate static site.

## API overview

```text
GET    /api/health
POST   /api/auth/register         POST /api/auth/login        GET /api/auth/me
GET    /api/machines              POST /api/machines
GET    /api/machines/:id          PUT  /api/machines/:id      DELETE /api/machines/:id
GET    /api/machines/:id/summary
GET    /api/machines/:id/maintenance   POST /api/maintenance   GET/PUT /api/maintenance/:id
GET    /api/machines/:id/failures      POST /api/failures
GET    /api/machines/:id/operational-data  POST /api/operational-data
POST   /api/analysis/maintenance-case
GET    /api/maintenance-cases          GET  /api/maintenance-cases/:id
POST   /api/maintenance-cases/:id/analyze
PUT    /api/maintenance-cases/:id/review
PUT    /api/maintenance-cases/:id/outcome
GET    /api/testing/cases              POST /api/testing/cases
GET    /api/reports/summary
GET    /api/ml/models             GET  /api/ml/models/:id      POST /api/ml/predict
```

All routes except `/api/health`, `/api/auth/register` and `/api/auth/login` require `Authorization: Bearer <token>`.

## Capstone test plan

| # | Test | How |
| --- | --- | --- |
| 1 | Backend starts | `npm run backend`, expect `[db] connected to MongoDB` |
| 2 | Expo Go opens | `npm run expo:start`, scan QR |
| 3 | Register / login | Login screen, then create account |
| 4 | Empty dashboard | Dashboard shows `No data available yet.` |
| 5 | Create machine | Machines -> `+ Add Machine` |
| 6 | Persistence | Close and reopen the app; machine still listed |
| 7 | Historical maintenance | Machine detail -> Maintenance history |
| 8 | Create case | Cases -> `+ Create maintenance case` |
| 9 | Analyze | `ANALYZE CASE` -> backend counts real records |
| 10 | Review suggestion | Accept / Modify / Reject with note |
| 11 | Actual maintenance | `Record actual maintenance & outcome` |
| 12 | Outcome | Save result, downtime, parts, cost |
| 13 | Machine history | Machine detail shows the completed case record |
| 14 | Reusable history | Create another case and re-run analysis; the completed case is now comparable evidence |

## Automated verification

```powershell
npm run typecheck:all                      # web + mobile + backend TypeScript
npm run build                              # Vite web build
npm run backend:build                      # backend compile
npx expo export --platform android         # Expo Router bundle for Expo Go
npx expo-doctor                            # Expo compatibility checks
```

`backend/scripts/e2e-check.cjs` runs a 30-check end-to-end verification (register, empty state, persistence,
insufficient-data refusal, evidence-based analysis, Layer 1 retrieval method and ranking, review, outcome, testing
case, report aggregates, role and validation guards, record edit/delete, cascade cleanup). It targets a
throwaway database such as `mdss_e2e` and drops that database when finished, so the real `mdss` database stays empty:

```powershell
# terminal 1 - API against the throwaway database
$env:MONGODB_URI='mongodb+srv://.../mdss_e2e?retryWrites=true&w=majority'
npm --prefix backend run dev

# terminal 2 - run the checks
$env:MONGODB_URI='mongodb+srv://.../mdss_e2e?retryWrites=true&w=majority'
node backend/scripts/e2e-check.cjs
```

`backend/scripts/ml-check.cjs` runs a 20-check live verification of the ML surface against a **started backend**.
It asserts that the endpoints require authentication, that all six cards are trained and cite the dataset
licence, that every card declares `synthetic: true`, a majority-class baseline, a confusion matrix and
limitations, that unknown model ids return 404 rather than a silent empty result, and — most importantly — that
the models respond to their inputs instead of returning a constant:

```text
PASS - model responds to inputs instead of returning a constant :: benign=0.1166 stressed=0.9788
PASS - high tool-wear/high-torque input raises predicted failure risk :: 0.1166 -> 0.9788
```

Use a throwaway database for this too, since the script registers a user:

```powershell
# terminal 1 - API on port 4010 against a scratch database
$env:PORT='4010'
$env:MONGODB_URI='mongodb+srv://.../mdss_mlcheck?retryWrites=true&w=majority'
npm --prefix backend run dev

# terminal 2 - run the ML checks
npm run ml:check
```

## Trained model artifacts

`backend/src/app.ts` loads the persisted cards and weights from `backend/data/models/` at start-up via
`hydrateFromDisk()`. The server **does not train at start-up** — training is a deliberate, separate step
(`npm run ml:train`) so it never runs in a request path or a cold boot.

This means `backend/data/` must be committed for a deployment to serve trained models. The Docker image copies
`backend/` wholesale and only runs `tsc`, so if the model JSON files are absent the deployed API reports zero
models and every prediction returns `status: 'not-trained'`. The directory holds:

```text
backend/data/ai4i2020.csv          training input, AI4I 2020, CC BY 4.0
backend/data/models/manifest.json  the model cards
backend/data/models/ai4i-*.json    the six fitted weight sets
```

Re-run `npm run ml:train` to regenerate them; the split is seeded (`CV_SEED = 42`) so results are reproducible.

## Security

- Passwords are hashed with bcrypt; the API never returns password hashes.
- JWT is signed server-side with `JWT_SECRET`; the app stores it with `expo-secure-store`.
- MongoDB URI, database password and JWT secret exist only in `backend/.env`, which is git-ignored.
- Never place database credentials in `EXPO_PUBLIC_*` variables; those values are bundled into the mobile app.
- Rotate the Atlas database password that was shared in plain text during development.

## Empty-database behaviour

| Condition | Message |
| --- | --- |
| No machines | `No machines registered yet.` |
| No maintenance | `No maintenance history available.` |
| No failures | `No failure records available.` |
| No cases | `No historical maintenance cases available.` |
| Not enough evidence | `Insufficient historical data for reliable analysis.` |

## Future IoT extension

Temperature, vibration, voltage and current are intentionally excluded from the prototype. Sensor ingestion can be
added later without changing the decision-support workflow: store readings in their own collection and pass them to the
same analysis service as additional evidence.


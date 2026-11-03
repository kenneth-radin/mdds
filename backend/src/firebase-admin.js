let admin;
try {
  admin = require("firebase-admin");
} catch (error) {
  // firebase-admin is not installed in this environment; Firebase sync is
  // unavailable until the package is added and FIREBASE_* credentials are set.
  admin = null;
  console.error(
    "[firebase-admin] require failed � Firebase sync disabled:",
    error instanceof Error ? error.message : error
  );
}

// Load credentials from environment variables
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "mdss-47750",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "929905540a995b12fa78c3a45e951c73453608a0",
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
  client_email: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@mdss-47750.iam.gserviceaccount.com",
  client_id: process.env.FIREBASE_CLIENT_ID || "110198409460767930931",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40mdss-47750.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

// Firebase credentials are optional so the API can boot without Firebase
// configured. The sync service reads `initialized` to know whether it may
// push sensor readings. Set FIREBASE_PRIVATE_KEY (and friends) in backend/.env
// to enable the real-time Firebase sync path.
const requiredEnvVars = ["FIREBASE_PRIVATE_KEY", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PROJECT_ID"];
const missing = requiredEnvVars.filter((v) => !process.env[v]);
const initialized = admin !== null && missing.length === 0;

console.log(
  "[firebase-admin] admin=" +
    (admin !== null ? "loaded" : "null") +
    ", missing=" +
    missing.join(", ") +
    ", initialized=" +
    initialized
);

if (!initialized) {
  console.warn(
    "Firebase admin not configured in this environment (missing: " +
      missing.join(", ") +
      "). Real-time Firebase sync is disabled until these are set in backend/.env."
  );
}

// Initialize Firebase Admin only when credentials are present.
// Wrapped in try/catch so the module always exports successfully even if
// initializeApp() throws (e.g. app already initialized elsewhere).
let initError = null;
if (initialized) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || "https://mdss-47750.firebaseio.com",
    });
  } catch (error) {
    initError = error;
    console.error(
      "[firebase-admin] initializeApp failed — Firebase sync disabled:",
      error instanceof Error ? error.message : error
    );
  }
}

const db = initialized && !initError ? admin.database() : null;
const firestore = initialized && !initError ? admin.firestore() : null;

module.exports = { admin, db, firestore, initialized: initialized && !initError };

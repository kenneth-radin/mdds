// Firebase web configuration for the Vite web prototype (src/).
//
// The official `firebase` npm package is optional and is NOT bundled with this
// repo. If it is missing (e.g. running the Expo mobile app, which does not
// carry it), this module still boots and exports null-safe { database, auth,
// signInAnonymously }, so the rest of the app keeps working. Install
// `firebase` + `@firebase/database` to enable live Firebase reads.

let database = null;
let auth = null;
let signInAnonymously = null;

async function loadFirebase() {
  if (database) return database;
  try {
    const [appMod, dbMod, authMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/database'),
      import('firebase/auth'),
    ]);

    const firebaseConfig = {
      apiKey: 'AIzaSyA0m9rICNlpjWJ8d_9To9s5gWYWZdCXlBA',
      authDomain: 'mdss-47750.firebaseapp.com',
      projectId: 'mdss-47750',
      storageBucket: 'mdss-47750.firebasestorage.app',
      messagingSenderId: '164366105',
      appId: '1:164366105:web:786056303d0caf5d456788',
      measurementId: 'G-WGEQ7VVZVM',
    };

    const appInstance = appMod.initializeApp(firebaseConfig);
    database = dbMod.getDatabase(appInstance);
    auth = authMod.getAuth(appInstance);
    signInAnonymously = authMod.signInAnonymously;

    return database;
  } catch (error) {
    console.warn(
      'Firebase SDK is not installed or unavailable; real-time Firebase sync disabled.',
      error
    );
    return null;
  }
}

export async function getFirebase() {
  if (!database) {
    await loadFirebase();
  }
  return { database, auth, signInAnonymously };
}

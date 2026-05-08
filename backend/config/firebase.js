import admin from 'firebase-admin';

let initialized = false;

export function initFirebase() {
  if (initialized) return;
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    console.log('[Firebase] Admin SDK initialized');
  } catch (err) {
    console.warn('[Firebase] Admin SDK not initialized — FIREBASE_SERVICE_ACCOUNT_JSON missing or invalid');
  }
}

export { admin };

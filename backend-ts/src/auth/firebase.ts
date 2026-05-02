import admin from 'firebase-admin';
import { config } from '../config.js';

let initialized = false;

export function ensureFirebase(): void {
    if (initialized) return;
    initialized = true;
    try {
        if (admin.apps.length > 0) return;
        // FIREBASE_ADMIN_CREDENTIALS may hold service-account JSON or a path.
        // Match the Python service's behavior: try default credentials, log on failure.
        if (config.firebaseAdminCredentials) {
            try {
                const parsed = JSON.parse(config.firebaseAdminCredentials);
                admin.initializeApp({ credential: admin.credential.cert(parsed) });
                return;
            } catch {
                // Fall through to default init
            }
        }
        admin.initializeApp();
    } catch (e) {
        console.warn('Firebase Admin initialization failed:', (e as Error).message);
    }
}

export async function verifyIdToken(token: string): Promise<{ uid: string; email: string | null }> {
    ensureFirebase();
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? null };
}

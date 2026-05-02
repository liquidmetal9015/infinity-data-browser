import { auth } from '../services/firebase';

/**
 * Get Firebase auth headers for API requests.
 * Returns a Bearer token header if the user is authenticated,
 * a dev token in dev mode, or an empty object otherwise.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
    if (import.meta.env.VITE_DEV_AUTH === 'true') {
        return { Authorization: 'Bearer dev-token' };
    }
    const user = auth?.currentUser;
    if (user) {
        const token = await user.getIdToken();
        return { Authorization: `Bearer ${token}` };
    }
    return {};
}

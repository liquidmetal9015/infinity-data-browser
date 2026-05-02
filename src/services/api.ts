import createClient from "openapi-fetch";
import type { paths } from "../types/schema";
import { getAuthHeaders } from "../utils/authHeaders";

const baseUrl = import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost");

const client = createClient<paths>({ baseUrl });

client.use({
    async onRequest({ request }) {
        const headers = await getAuthHeaders();
        for (const [key, value] of Object.entries(headers)) {
            request.headers.set(key, value);
        }
        return request;
    },
});

export default client;

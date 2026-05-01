import createClient from "openapi-fetch";
import type { paths } from "../types/schema";
import { auth } from "./firebase";

const baseURL = import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost");

const client = createClient<paths>({ baseURL });

client.use({
    async onRequest({ request }) {
        if (import.meta.env.VITE_DEV_AUTH === 'true') {
            request.headers.set("Authorization", "Bearer dev-token");
            return request;
        }
        const user = auth?.currentUser;
        if (user) {
            const token = await user.getIdToken();
            request.headers.set("Authorization", `Bearer ${token}`);
        }
        return request;
    },
});

export default client;

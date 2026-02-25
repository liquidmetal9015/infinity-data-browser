export function getSafeLogo(url?: string | null): string | undefined {
    if (!url) return undefined;

    // Map Corvus Belli asset URLs to our local public folder structure
    if (url.startsWith('http')) {
        const filename = url.split('/').pop();

        if (url.includes('/factions/') || url.includes('logo/factions/')) {
            return `${import.meta.env.BASE_URL}logos/factions/${filename}`;
        } else if (url.includes('/units/') || url.includes('logo/units/')) {
            return `${import.meta.env.BASE_URL}logos/units/${filename}`;
        }

        // Only if it doesn't match our known asset paths do we let it pass
        return url;
    }

    // Already a local path, ensure it has the correct base URL
    return `${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`;
}

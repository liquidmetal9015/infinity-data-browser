// Browser-specific army code utility - kept in frontend only
// For encoding/decoding logic, import from '@shared/armyCode'

/**
 * Copy army code to clipboard.
 */
export async function copyArmyCodeToClipboard(code: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(code);
        return true;
    } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
    }
}

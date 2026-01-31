// Re-export army code utilities from shared module
// Plus browser-specific helpers that remain in the frontend

export {
    decodeArmyCode,
    encodeArmyList,
    isValidArmyCode,
} from '../../shared/armyCode';

export type {
    DecodedArmyList,
    DecodedCombatGroup,
    DecodedMember,
    EncodableArmyList,
} from '../../shared/armyCode';

// Browser-specific helper - kept in frontend only
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

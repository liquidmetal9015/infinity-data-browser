/**
 * Army Code Encoder/Decoder - MCP Port
 * 
 * Ported from src/utils/armyCode.ts for use in MCP server.
 */

// ============================================================================
// VLI (Variable Length Integer) Encoding
// ============================================================================

function readVLI(view: DataView, offset: { value: number }): number {
    const firstByte = view.getUint8(offset.value);
    offset.value++;

    if (firstByte < 128) {
        return firstByte;
    }

    // Two-byte encoding: first byte has high bit set
    const secondByte = view.getUint8(offset.value);
    offset.value++;

    // Clear high bit and combine
    return ((firstByte & 0x7F) << 8) | secondByte;
}

function readString(view: DataView, offset: { value: number }): string {
    const length = readVLI(view, offset);
    if (length === 0) return '';

    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = view.getUint8(offset.value);
        offset.value++;
    }

    return new TextDecoder('utf-8').decode(bytes);
}

// ============================================================================
// Army Code Decoding
// ============================================================================

export interface DecodedArmyList {
    factionId: number;
    factionSlug: string;
    armyName: string;
    maxPoints: number;
    combatGroups: DecodedCombatGroup[];
}

export interface DecodedCombatGroup {
    groupNumber: number;
    members: DecodedMember[];
}

export interface DecodedMember {
    unitId: number;
    groupChoice: number;  // profileGroupId
    optionChoice: number; // optionId
}

/**
 * Decode an army code string into its components.
 */
export function decodeArmyCode(armyCode: string): DecodedArmyList {
    // Handle URL encoding (CB sometimes URL encodes the base64)
    let cleanCode = armyCode;
    try {
        cleanCode = decodeURIComponent(armyCode);
    } catch {
        // Already decoded or not URL encoded
    }

    // Decode base64
    const binaryString = atob(cleanCode);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const view = new DataView(bytes.buffer);
    const offset = { value: 0 };

    // Read header
    const factionId = readVLI(view, offset);
    const factionSlug = readString(view, offset);
    const armyName = readString(view, offset);
    const maxPoints = readVLI(view, offset);
    const combatGroupCount = readVLI(view, offset);

    // Read combat groups
    const combatGroups: DecodedCombatGroup[] = [];
    for (let i = 0; i < combatGroupCount; i++) {
        const groupNumber = readVLI(view, offset);

        // Skip unknown bytes (0x01 0x00 or similar, seen in official codes)
        const byte1 = view.getUint8(offset.value);
        offset.value++;

        let memberCount: number;
        if (byte1 === 0x01 || byte1 === 0x00) {
            const byte2 = view.getUint8(offset.value);
            offset.value++;
            if (byte2 === 0x00) {
                memberCount = readVLI(view, offset);
            } else {
                memberCount = byte2;
            }
        } else {
            memberCount = byte1;
        }

        const members: DecodedMember[] = [];
        for (let j = 0; j < memberCount; j++) {
            // Read the leading 0x00 byte
            offset.value++;

            const unitId = readVLI(view, offset);
            const groupChoice = readVLI(view, offset);
            const optionChoice = readVLI(view, offset);

            // Read the trailing 0x00 byte
            offset.value++;

            members.push({ unitId, groupChoice, optionChoice });
        }

        combatGroups.push({ groupNumber, members });
    }

    return {
        factionId,
        factionSlug,
        armyName,
        maxPoints,
        combatGroups,
    };
}

/**
 * Army Code Encoder/Decoder
 * 
 * Army codes are base64 encoded strings that represent army lists.
 * Format based on Corvus Belli's Infinity Army builder.
 */

import type { Unit } from './types.js';

// ============================================================================
// Types
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

// Interface for army list (minimal definition for encoding)
export interface EncodableArmyList {
    factionId: number;
    name?: string;
    pointsLimit: number;
    groups: {
        units: {
            unit: Unit;
            profileGroupId: number;
            optionId: number;
        }[];
    }[];
}

// ============================================================================
// VLI (Variable Length Integer) Encoding
// ============================================================================

/**
 * Read a Variable Length Integer from a DataView.
 */
function readVLI(view: DataView, offset: { value: number }): number {
    const firstByte = view.getUint8(offset.value);
    offset.value++;

    if (firstByte < 128) {
        return firstByte;
    }

    const secondByte = view.getUint8(offset.value);
    offset.value++;

    return ((firstByte & 0x7F) << 8) | secondByte;
}

/**
 * Write a Variable Length Integer to a byte array.
 */
function writeVLI(value: number): number[] {
    if (value < 128) {
        return [value];
    }

    const highByte = 0x80 | ((value >> 8) & 0x7F);
    const lowByte = value & 0xFF;
    return [highByte, lowByte];
}

/**
 * Read a string (length-prefixed) from a DataView.
 */
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

/**
 * Write a string (length-prefixed) to a byte array.
 */
function writeString(str: string): number[] {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return [...writeVLI(bytes.length), ...bytes];
}

// ============================================================================
// Army Code Decoding
// ============================================================================

/**
 * Decode an army code string into its components.
 */
export function decodeArmyCode(armyCode: string): DecodedArmyList {
    // Handle URL encoding
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
            offset.value++; // Leading separator

            const unitId = readVLI(view, offset);
            const groupChoice = readVLI(view, offset);
            const optionChoice = readVLI(view, offset);

            offset.value++; // Trailing terminator

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

// ============================================================================
// Army Code Encoding
// ============================================================================

/**
 * Encode an army list into an army code string.
 */
export function encodeArmyList(
    list: EncodableArmyList,
    factionSlug: string,
    getUnitId: (unit: Unit) => number
): string {
    const bytes: number[] = [];

    // Header
    bytes.push(...writeVLI(list.factionId));
    bytes.push(...writeString(factionSlug));
    bytes.push(...writeString(list.name || ' '));
    bytes.push(...writeVLI(list.pointsLimit));
    bytes.push(...writeVLI(list.groups.length));

    // Combat groups
    list.groups.forEach((group, groupIndex) => {
        bytes.push(...writeVLI(groupIndex + 1));
        bytes.push(0x01);
        bytes.push(0x00);
        bytes.push(...writeVLI(group.units.length));

        group.units.forEach((listUnit) => {
            bytes.push(0x00);
            bytes.push(...writeVLI(getUnitId(listUnit.unit)));
            bytes.push(...writeVLI(listUnit.profileGroupId));
            bytes.push(...writeVLI(listUnit.optionId));
            bytes.push(0x00);
        });
    });

    // Convert to base64
    const uint8Array = new Uint8Array(bytes);
    const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
}

/**
 * Validate that an army code is well-formed.
 */
export function isValidArmyCode(code: string): boolean {
    try {
        decodeArmyCode(code);
        return true;
    } catch {
        return false;
    }
}

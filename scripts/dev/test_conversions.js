// Test CM to Inch conversions (5cm = 2")
const CM_TO_INCH_RATIO = 2 / 5; // 0.4

function cmToInches(cm) {
    return cm * CM_TO_INCH_RATIO;
}

function formatDistance(cm) {
    return Math.round(cmToInches(cm)).toString();
}

function formatMove(move) {
    if (!Array.isArray(move) || move.length !== 2) {
        return '-';
    }
    return `${formatDistance(move[0])}-${formatDistance(move[1])}`;
}

console.log('Testing CM to Inch conversions (5cm = 2"):');
console.log('');

// Test basic conversion
console.log('Basic conversions:');
console.log(`10cm = ${cmToInches(10)}" (expected: 4)`);
console.log(`15cm = ${cmToInches(15)}" (expected: 6)`);
console.log(`5cm = ${cmToInches(5)}" (expected: 2)`);
console.log('');

// Test formatDistance (rounds to integer)
console.log('Format distance:');
console.log(`10cm = ${formatDistance(10)}" (expected: 4)`);
console.log(`15cm = ${formatDistance(15)}" (expected: 6)`);
console.log(`5cm = ${formatDistance(5)}" (expected: 2)`);
console.log(`20cm = ${formatDistance(20)}" (expected: 8)`);
console.log('');

// Test formatMove
console.log('Format move values:');
console.log(`[10, 10] = ${formatMove([10, 10])} (expected: 4-4)`);
console.log(`[15, 10] = ${formatMove([15, 10])} (expected: 6-4)`);
console.log(`[15, 5] = ${formatMove([15, 5])} (expected: 6-2)`);
console.log(`[20, 10] = ${formatMove([20, 10])} (expected: 8-4)`);
console.log('');

// Test distance modifiers
console.log('Distance modifier conversions:');
const testModifiers = ['+10', '+5', '-6', '-3', '+2.5'];
testModifiers.forEach(mod => {
    const match = mod.match(/^([+\-]?)(\d+\.?\d*)$/);
    if (match) {
        const sign = match[1] || '';
        const cmValue = parseFloat(match[2]);
        const inchValue = Math.round(cmValue * 0.4);
        console.log(`${mod}cm = ${sign}${inchValue}"`);
    }
});

export default {
    extends: ['stylelint-config-standard', 'stylelint-config-css-modules'],
    ignoreFiles: ['dist/**', 'node_modules/**'],
    rules: {
        // ── Structural rules we care about ──────────────────────────────────
        'no-duplicate-selectors': true,
        'declaration-block-no-duplicate-properties': [true, {
            ignore: ['consecutive-duplicates-with-different-syntaxes'],
        }],
        'declaration-block-no-shorthand-property-overrides': true,
        'block-no-empty': true,
        'color-no-invalid-hex': true,

        // ── Tailwind v4 ──────────────────────────────────────────────────────
        'at-rule-no-unknown': [true, {
            ignoreAtRules: ['tailwind', 'apply', 'layer', 'utility', 'variant'],
        }],

        // ── Disable noisy modernisation rules ───────────────────────────────
        // These flag rgba(), font name quotes, vendor prefixes, etc.
        // We'll clean these up separately; they aren't structural bugs.
        'color-function-notation': null,
        'color-function-alias-notation': null,
        'alpha-value-notation': null,
        'import-notation': null,
        'value-keyword-case': null,
        'font-family-name-quotes': null,
        'property-no-vendor-prefix': null,
        'media-feature-range-notation': null,
        'shorthand-property-no-redundant-values': null,
        'no-descending-specificity': null,
        'rule-empty-line-before': null,
        'comment-empty-line-before': null,
        'color-hex-length': null,
        'declaration-block-single-line-max-declarations': null,

        // ── CSS Modules: class naming ────────────────────────────────────────
        // Allow camelCase too since JS references use camelCase
        'selector-class-pattern': ['^[a-z][a-zA-Z0-9-]*$', { resolveNestedSelectors: true }],
    },
    overrides: [{
        // index.css is intentionally global — relax module-specific rules
        files: ['src/index.css'],
        rules: {
            'selector-class-pattern': null,
        },
    }],
};

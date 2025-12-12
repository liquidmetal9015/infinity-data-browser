/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                cyber: {
                    bg: '#030712',      // Deepest blue/black
                    panel: '#0f172a',   // Slate 900
                    border: '#1e293b',  // Slate 800
                    text: '#e2e8f0',    // Slate 200
                    muted: '#94a3b8',   // Slate 400
                    cyan: '#06b6d4',    // Cyan 500
                    primary: '#22d3ee', // Cyan 400 - Main accent
                    accent: '#f472b6',  // Pink 400 - Secondary accent
                    success: '#4ade80', // Green 400
                    danger: '#f87171',  // Red 400
                },
                // New Design System Colors
                bg: {
                    primary: 'var(--bg-primary)',
                    secondary: 'var(--bg-secondary)',
                    tertiary: 'var(--bg-tertiary)',
                    elevated: 'var(--bg-elevated)',
                },
                text: {
                    primary: 'var(--text-primary)',
                    secondary: 'var(--text-secondary)',
                    muted: 'var(--text-muted)',
                },
                border: 'var(--border)',
                surface: {
                    DEFAULT: 'var(--surface)',
                    hover: 'var(--surface-hover)',
                    active: 'var(--surface-active)',
                },
                accent: {
                    DEFAULT: 'var(--accent)',
                    hover: 'var(--accent-hover)',
                    muted: 'var(--accent-muted)',
                },
                'skill-color': 'var(--skill-color)',
                'weapon-color': 'var(--weapon-color)',
                'equip-color': 'var(--equip-color)',
            },
            backgroundImage: {
                'grid-pattern': "linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)",
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
            },
            animation: {
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }
        },
    },
    plugins: [],
}

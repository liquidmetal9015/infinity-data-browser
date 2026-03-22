# Styling System

## Tailwind CSS v4

The app uses Tailwind CSS v4 with the `@import "tailwindcss"` syntax in `src/index.css` (not the old `@tailwind` directives).

## Design Tokens

Core design values are defined as CSS custom properties in `src/index.css` and exposed to Tailwind via `tailwind.config.js`:

```css
:root {
  /* Backgrounds */
  --bg-primary: #0a0a0b;
  --bg-secondary: #111113;
  --bg-tertiary: #18181b;
  --bg-elevated: #1f1f23;

  /* Surfaces */
  --surface: rgba(255, 255, 255, 0.03);
  --surface-hover: rgba(255, 255, 255, 0.06);
  --surface-active: rgba(255, 255, 255, 0.08);

  /* Text */
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;

  /* Accent */
  --accent: #6366f1;  /* Indigo */
}
```

## Conventions

- Use Tailwind utility classes with semantic color tokens (`bg-primary`, `text-secondary`) — not raw hex values.
- Use `clsx` and `tailwind-merge` for conditional/merged class names.
- Use `framer-motion` for complex animations.
- Some components have co-located `.css` files for styles that don't map well to utilities (e.g., `WindowFrame.css`, `WorkspaceView.css`).

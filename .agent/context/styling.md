# Styling System

## Tailwind CSS v4
The application heavily utilizes Tailwind CSS for utility-first styling. 
**Note**: The project runs on Tailwind v4, which uses the `@import "tailwindcss"` syntax in `index.css` rather than the old `@tailwind` directives.

## Design Tokens & Custom Properties
Core design values (colors, spacing, typography) are maintained as CSS Custom Properties in `src/index.css` and exposed to Tailwind via `tailwind.config.js`.

```css
/* Example index.css tokens */
:root {
  /* Core Colors */
  --bg-primary: #0a0a0b;
  --bg-secondary: #111113;
  --bg-tertiary: #18181b;
  --bg-elevated: #1f1f23;

  /* Surface Colors */
  --surface: rgba(255, 255, 255, 0.03);
  --surface-hover: rgba(255, 255, 255, 0.06);
  --surface-active: rgba(255, 255, 255, 0.08);

  /* Text Colors */
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;

  /* Accent */
  --accent: #6366f1;      /* Indigo */
}
```

## Styling Patterns
- Always prefer Tailwind utility classes for colors, layout, and simple components.
- Rely on semantic color tokens (e.g., `bg-primary`, `text-secondary`) rather than hardcoded hex codes.
- Use `framer-motion` for complex UI animation orchestrations.

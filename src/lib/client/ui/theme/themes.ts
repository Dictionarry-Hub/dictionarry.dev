// Single source of truth for theme identity. The switcher options and the
// Theme type both derive from this list.
//
// Adding a theme:
//   1. Create src/styles/themes/<id>.css with the complete token set
//      (light.css is the canonical contract), a color-scheme declaration,
//      and the --theme-image-* display tokens.
//   2. Add an entry here.
//   3. Add the @import in src/routes/layout.css.
// The theme-sync lint rule (pnpm lint:ui) enforces all of it.
//
// 'system' is a meta-theme resolved to light or dark at runtime; it has no
// CSS file.

export interface ThemeDefinition {
	id: string;
	label: string;
	emoji: string;
}

export const THEME_DEFINITIONS = [
	{ id: 'system', label: 'System', emoji: '🖥️' },
	{ id: 'light', label: 'Light', emoji: '💡' },
	{ id: 'dark', label: 'Dark', emoji: '🌑' },
	{ id: 'retro', label: 'Retro', emoji: '📼' },
	{ id: 'roswell', label: 'Roswell', emoji: '👽' },
	{ id: 'voyager', label: 'Voyager', emoji: '📀' }
] as const satisfies readonly ThemeDefinition[];

export type Theme = (typeof THEME_DEFINITIONS)[number]['id'];

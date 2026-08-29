// Single source of truth for theme identity. The switcher options and the
// Theme type both derive from this list. Icons are Lucide components; Lucide
// Lab icons (@lucide/lab) are wrapped as components in ./icons/.
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

import type { Component } from 'svelte';
import { Laptop, Moon, Sun } from '@lucide/svelte';
import AstronautHelmet from './icons/AstronautHelmet.svelte';
import FloppyDisk2 from './icons/FloppyDisk2.svelte';
import Ufo from './icons/Ufo.svelte';

export interface ThemeDefinition {
	id: string;
	label: string;
	icon: Component<{ size?: number; class?: string }>;
}

export const THEME_DEFINITIONS = [
	{ id: 'system', label: 'System', icon: Laptop },
	{ id: 'light', label: 'Light', icon: Sun },
	{ id: 'dark', label: 'Dark', icon: Moon },
	{ id: 'retro', label: 'Retro', icon: FloppyDisk2 },
	{ id: 'roswell', label: 'Roswell', icon: Ufo },
	{ id: 'voyager', label: 'Voyager', icon: AstronautHelmet }
] as const satisfies readonly ThemeDefinition[];

export type Theme = (typeof THEME_DEFINITIONS)[number]['id'];

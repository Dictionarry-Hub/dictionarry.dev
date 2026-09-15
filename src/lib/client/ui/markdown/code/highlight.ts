import type { HighlighterCore } from 'shiki/core';

const languageLoaders = {
	javascript: () => import('shiki/langs/javascript.mjs'),
	typescript: () => import('shiki/langs/typescript.mjs'),
	json: () => import('shiki/langs/json.mjs'),
	yaml: () => import('shiki/langs/yaml.mjs'),
	shellscript: () => import('shiki/langs/shellscript.mjs'),
	python: () => import('shiki/langs/python.mjs'),
	sql: () => import('shiki/langs/sql.mjs'),
	markdown: () => import('shiki/langs/markdown.mjs'),
	jsx: () => import('shiki/langs/jsx.mjs'),
	tsx: () => import('shiki/langs/tsx.mjs'),
	html: () => import('shiki/langs/html.mjs'),
	csharp: () => import('shiki/langs/csharp.mjs')
} as const;

type HighlightLanguage = keyof typeof languageLoaders;

const aliases: Record<string, HighlightLanguage> = {
	'js': 'javascript',
	'ts': 'typescript',
	'sh': 'shellscript',
	'bash': 'shellscript',
	'shell': 'shellscript',
	'zsh': 'shellscript',
	'py': 'python',
	'yml': 'yaml',
	'md': 'markdown',
	'cs': 'csharp',
	'c#': 'csharp'
};

const plainLanguages = new Set(['text', 'txt', 'plaintext']);
const languagePromises = new Map<HighlightLanguage, Promise<HighlighterCore>>();
let highlighterPromise: Promise<HighlighterCore> | undefined;

async function getHighlighter(): Promise<HighlighterCore> {
	if (!highlighterPromise) {
		highlighterPromise = Promise.all([import('shiki/core'), import('shiki/engine/javascript')])
			.then(
				([
					{ createCssVariablesTheme, createHighlighterCore },
					{ createJavaScriptRegexEngine }
				]) =>
					createHighlighterCore({
						themes: [
							createCssVariablesTheme({
								name: 'css-variables',
								variablePrefix: '--theme-code-',
								fontStyle: true
							})
						],
						langs: [],
						engine: createJavaScriptRegexEngine()
					})
			)
			.catch((error: unknown) => {
				highlighterPromise = undefined;
				throw error;
			});
	}

	return highlighterPromise;
}

function resolveLanguage(language: string): HighlightLanguage | null {
	const normalized = language.toLowerCase();
	if (plainLanguages.has(normalized)) return null;

	const resolved = aliases[normalized] ?? normalized;
	return Object.hasOwn(languageLoaders, resolved) ? (resolved as HighlightLanguage) : null;
}

async function loadLanguage(language: HighlightLanguage): Promise<HighlighterCore> {
	let promise = languagePromises.get(language);
	if (!promise) {
		promise = Promise.all([getHighlighter(), languageLoaders[language]()])
			.then(async ([highlighter, module]) => {
				await highlighter.loadLanguage(...module.default);
				return highlighter;
			})
			.catch((error: unknown) => {
				languagePromises.delete(language);
				throw error;
			});
		languagePromises.set(language, promise);
	}

	return promise;
}

/** Highlight code on demand. Plain and unsupported languages return no highlighted HTML. */
export async function highlight(code: string, language: string): Promise<string | null> {
	const resolved = resolveLanguage(language);
	if (!resolved) return null;

	const highlighter = await loadLanguage(resolved);
	return highlighter.codeToHtml(code, { lang: resolved, theme: 'css-variables' });
}

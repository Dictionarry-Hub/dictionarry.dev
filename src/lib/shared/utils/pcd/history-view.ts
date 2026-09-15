// Turns raw entity changes (path plus before/after values) into something a
// person can read. A presenter exists for each change shape that matters:
// measured across every PCD repo, profile scoring, custom format conditions,
// regex patterns, profile qualities, tags, and quality definition tiers are
// 95% of all changes ever made. Anything else falls back to a YAML diff of
// the changed subtree, in the same YAML the entity export view uses.

import type { EntityChange, Condition, QualityEntry, ProfileScore } from '$lib/types/pcd';
import {
	formatConditionArrType,
	formatConditionType,
	formatConditionValue,
	formatTierMaxSize,
	formatTierSize,
	NAMING_FORMAT_LABELS,
	TIER_SIZE_UNIT_LABELS
} from './format.js';
import { entityHref, formatChangePath } from './history.js';
import { formatProfileScore } from './references.js';
import { stringifyYaml } from '../yaml/stringify.js';
import { marked } from 'marked';

export type SummaryPart =
	| { kind: 'text'; text: string }
	| {
			kind: 'ref';
			text: string;
			href: string | null;
			external?: boolean;
			/** Colour the pill as something that joined or left. */
			tone?: 'added' | 'removed';
	  };

export interface DiffSegment {
	kind: 'same' | 'added' | 'removed';
	text: string;
}

export interface MarkdownBlock {
	kind: 'same' | 'added' | 'removed' | 'changed';
	/** Rendered HTML. Changed blocks carry ins and del elements. */
	html: string;
}

export type ChangeDetail =
	| { kind: 'lines'; lines: DiffSegment[] }
	| { kind: 'chars'; segments: DiffSegment[] }
	| { kind: 'replace'; before: string; after: string }
	| { kind: 'markdown'; blocks: MarkdownBlock[] }
	| { kind: 'markdown-replace'; beforeHtml: string; afterHtml: string };

/**
 * Share of a text touched above which the change is shown as before and
 * after instead of an inline diff: past this point it is a rewrite, and a
 * rewrite has nothing readable to diff. Measured in tokens for plain text
 * and in blocks for markdown.
 */
export const TEXT_REWRITE_THRESHOLD = 0.5;

export interface ChangeView {
	summary: SummaryPart[];
	detail?: ChangeDetail;
}

export interface PresentContext {
	database: string;
	/** Whether an entity page exists to link to. */
	exists(entityType: string, name: string): boolean;
	/** The entity's current state, for labelling changes to nested items. */
	current: unknown;
}

interface PathSegment {
	key: string;
	item?: string;
}

/**
 * Present one change, or null when the change is invisible in display terms
 * (e.g. a tier max size moving between two values that both mean unlimited).
 */
export function presentChange(
	entityType: string,
	change: EntityChange,
	ctx: PresentContext
): ChangeView | null {
	const path = parsePath(change.path);
	const [head, second, third] = path;

	if (head?.key === 'scoring' && head.item !== undefined) {
		return presentScoring(change, head.item, second, ctx);
	}
	if (head?.key === 'conditions' && head.item !== undefined) {
		return presentCondition(change, head.item, path.slice(1), ctx);
	}
	if (head?.key === 'pattern' && path.length === 1) {
		return presentText([text('Pattern changed')], change);
	}
	if (head?.key === 'description' && path.length === 1) {
		return presentMarkdown([text(`Description ${verb(change)}`)], change);
	}
	if (head?.key === 'formats' && second !== undefined && path.length === 2) {
		const label = NAMING_FORMAT_LABELS[second.key] ?? formatChangePath(second.key);
		return presentText([text(`${label} ${verb(change)}`)], change);
	}
	if (head?.key === 'regex101Id' && path.length === 1) {
		return presentRegex101(change);
	}
	if (head?.key === 'tags' && path.length === 1) {
		return presentSet('Tags', change);
	}
	if (head?.key === 'qualities' && head.item !== undefined) {
		if (second?.key === 'group' && third?.key === 'members') {
			return presentSet(`Group ${head.item} members`, change);
		}
		return presentQuality(change, head.item, second);
	}
	if (head?.key === 'tiers' && head.item !== undefined && second !== undefined) {
		return presentTier(entityType, change, head.item, second.key);
	}
	if (path.length === 1 && isScalar(change.from) && isScalar(change.to)) {
		return presentScalar(formatChangePath(change.path), change);
	}
	return fallback(change);
}

// --- Profile scoring ---

function presentScoring(
	change: EntityChange,
	key: string,
	field: PathSegment | undefined,
	ctx: PresentContext
): ChangeView {
	const split = key.lastIndexOf('|');
	const name = key.slice(0, split);
	const arr = formatConditionArrType(key.slice(split + 1));
	const cf = ref(name, 'custom_format', ctx);

	if (field === undefined && change.kind === 'added') {
		const score = (change.to as ProfileScore).score;
		return { summary: [cf, text(` scored ${formatProfileScore(score)} for ${arr}`)] };
	}
	if (field === undefined && change.kind === 'removed') {
		return { summary: [cf, text(` no longer scored for ${arr}`)] };
	}
	if (field?.key === 'score' && change.kind === 'changed') {
		const from = formatProfileScore(change.from as number);
		const to = formatProfileScore(change.to as number);
		return { summary: [cf, text(` score ${from} to ${to} for ${arr}`)] };
	}
	return fallback(change);
}

// --- Custom format conditions ---

function presentCondition(
	change: EntityChange,
	name: string,
	rest: PathSegment[],
	ctx: PresentContext
): ChangeView {
	if (rest.length === 0 && (change.kind === 'added' || change.kind === 'removed')) {
		const condition = (change.kind === 'added' ? change.to : change.from) as Condition;
		const summary = [
			text(`${formatConditionType(condition.type)} `),
			conditionValue(condition, ctx)
		];
		if (condition.name !== formatConditionValue(condition.data)) {
			summary.push(text(` as ${condition.name}`));
		}
		summary.push(text(` ${change.kind}`));
		const flags = [
			condition.negate ? 'negated' : '',
			condition.required ? 'required' : ''
		].filter(Boolean);
		if (flags.length > 0) summary.push(text(` (${flags.join(', ')})`));
		if (condition.arrType !== 'all') {
			summary.push(text(` for ${formatConditionArrType(condition.arrType)}`));
		}
		return { summary };
	}

	const subject = [text(`${conditionLabel(name, ctx)} `), ref(name, null, ctx)];
	const field = rest.map((segment) => segment.key).join('.');

	if (change.kind === 'changed') {
		switch (field) {
			case 'arrType':
				return {
					summary: [
						...subject,
						text(` now applies to ${formatConditionArrType(String(change.to))}`)
					]
				};
			case 'negate':
				return {
					summary: [...subject, text(change.to ? ' now negated' : ' no longer negated')]
				};
			case 'required':
				return {
					summary: [...subject, text(change.to ? ' now required' : ' no longer required')]
				};
			case 'data.regularExpressionName':
				return {
					summary: [
						...subject,
						text(' now uses '),
						ref(String(change.to), 'regular_expression', ctx)
					]
				};
		}
		if (isScalar(change.from) && isScalar(change.to)) {
			const label = formatChangePath(rest.at(-1)?.key ?? field);
			return {
				summary: [
					...subject,
					text(` ${lowerFirst(label)} ${scalar(change.from)} to ${scalar(change.to)}`)
				]
			};
		}
	}
	return fallback(change, subject);
}

function conditionValue(condition: Condition, ctx: PresentContext): SummaryPart {
	const data = condition.data;
	if (data.type === 'release_title' || data.type === 'release_group' || data.type === 'edition') {
		return ref(data.regularExpressionName, 'regular_expression', ctx);
	}
	return { kind: 'ref', text: formatConditionValue(data), href: null };
}

function conditionLabel(name: string, ctx: PresentContext): string {
	const conditions = (ctx.current as { conditions?: Condition[] } | null)?.conditions;
	const match = conditions?.find((condition) => condition.name === name);
	return match ? formatConditionType(match.type) : 'Condition';
}

// --- Profile qualities ---

function presentQuality(
	change: EntityChange,
	name: string,
	field: PathSegment | undefined
): ChangeView {
	const subject = ref(name, null);
	if (field === undefined && (change.kind === 'added' || change.kind === 'removed')) {
		const entry = (change.kind === 'added' ? change.to : change.from) as QualityEntry;
		const label = entry.group ? 'Quality group' : 'Quality';
		const summary = [text(`${label} `), subject, text(` ${change.kind}`)];
		if (entry.group && entry.group.members.length > 0) {
			summary.push(text(` (${entry.group.members.join(', ')})`));
		}
		if (change.kind === 'added' && !entry.enabled) summary.push(text(', disabled'));
		return { summary };
	}
	if (change.kind === 'changed') {
		switch (field?.key) {
			case 'position':
				return {
					summary: [
						subject,
						text(` moved from position ${scalar(change.from)} to ${scalar(change.to)}`)
					]
				};
			case 'enabled':
				return { summary: [subject, text(change.to ? ' enabled' : ' disabled')] };
			case 'upgradeUntil':
				return {
					summary: [
						subject,
						text(
							change.to
								? ' is now the upgrade-until quality'
								: ' is no longer the upgrade-until quality'
						)
					]
				};
		}
	}
	return fallback(change, [subject, text(' ')]);
}

// --- Quality definition tiers ---

function presentTier(
	entityType: string,
	change: EntityChange,
	quality: string,
	field: string
): ChangeView | null {
	if (
		change.kind !== 'changed' ||
		typeof change.from !== 'number' ||
		typeof change.to !== 'number'
	) {
		return fallback(change);
	}
	const arr = entityType.startsWith('radarr') ? 'radarr' : 'sonarr';
	const unit = TIER_SIZE_UNIT_LABELS['mb-min'];
	const fmt = (value: number) => {
		const max = field === 'maxSize' ? formatTierMaxSize(value, 'mb-min', arr) : null;
		return max === 'Unlimited' ? max : `${formatTierSize(value, 'mb-min')} ${unit}`;
	};
	const labels: Record<string, string> = {
		minSize: 'min size',
		maxSize: 'max size',
		preferredSize: 'preferred size'
	};
	const label = labels[field];
	if (label === undefined) return fallback(change);
	const from = fmt(change.from);
	const to = fmt(change.to);
	if (from === to) return null;
	return { summary: [ref(quality, null), text(` ${label} ${from} to ${to}`)] };
}

// --- Generic shapes ---

/** Arrays of strings (tags, group members): report what joined and left. */
function presentSet(label: string, change: EntityChange): ChangeView {
	const from = new Set(Array.isArray(change.from) ? change.from.map(String) : []);
	const to = new Set(Array.isArray(change.to) ? change.to.map(String) : []);
	const added = [...to].filter((item) => !from.has(item));
	const removed = [...from].filter((item) => !to.has(item));
	if (added.length === 0 && removed.length === 0) {
		return { summary: [text(`${label} reordered`)] };
	}
	// The pill colours say added or removed; the words would repeat them.
	const summary: SummaryPart[] = [text(`${label} `)];
	summary.push(...pills(added, 'added'));
	if (added.length > 0 && removed.length > 0) summary.push(text(' '));
	summary.push(...pills(removed, 'removed'));
	return { summary };
}

function pills(names: string[], tone: 'added' | 'removed'): SummaryPart[] {
	return names.flatMap((name, index) => {
		const pill: SummaryPart = { kind: 'ref', text: name, href: null, tone };
		return index === 0 ? [pill] : [text(', '), pill];
	});
}

function presentRegex101(change: EntityChange): ChangeView {
	const link = (id: string): SummaryPart => ({
		kind: 'ref',
		text: id,
		href: `https://regex101.com/r/${id}`,
		external: true
	});
	if (typeof change.to === 'string' && change.to !== '') {
		const word = typeof change.from === 'string' && change.from !== '' ? 'updated to' : 'added';
		return { summary: [text(`regex101 link ${word} `), link(change.to)] };
	}
	return { summary: [text('regex101 link removed')] };
}

function presentScalar(label: string, change: EntityChange): ChangeView {
	if (change.kind === 'changed' && typeof change.to === 'boolean') {
		return { summary: [text(`${label} ${change.to ? 'enabled' : 'disabled'}`)] };
	}
	if (change.kind === 'added') return { summary: [text(`${label} set to ${scalar(change.to)}`)] };
	if (change.kind === 'removed') return { summary: [text(`${label} removed`)] };
	if (typeof change.from === 'string' && typeof change.to === 'string') {
		if (change.from.length > 40 || change.to.length > 40) {
			return presentText([text(`${label} changed`)], change);
		}
	}
	return { summary: [text(`${label} ${scalar(change.from)} to ${scalar(change.to)}`)] };
}

function fallback(change: EntityChange, prefix: SummaryPart[] = []): ChangeView {
	const summary =
		prefix.length > 0
			? [...prefix, text(`${verb(change)}`)]
			: [text(`${formatChangePath(change.path)} ${verb(change)}`)];
	return withLineDiff(summary, change, true);
}

function withLineDiff(summary: SummaryPart[], change: EntityChange, yaml = false): ChangeView {
	const render = (value: unknown): string[] => {
		if (value === undefined) return [];
		const source = yaml || typeof value !== 'string' ? stringifyYaml(value) : value;
		return source.replace(/\n$/, '').split('\n');
	};
	const lines = diffSequences(render(change.from), render(change.to));
	return { summary, detail: { kind: 'lines', lines } };
}

/**
 * Long plain text fields (patterns, naming formats). A small edit shows as
 * an inline diff; a rewrite shows before and after.
 */
function presentText(summary: SummaryPart[], change: EntityChange): ChangeView {
	const before = typeof change.from === 'string' ? change.from : '';
	const after = typeof change.to === 'string' ? change.to : '';
	if (before === '' || after === '') {
		return { summary, detail: { kind: 'replace', before, after } };
	}
	const segments = diffText(before, after);
	if (touchedShare(segments) > TEXT_REWRITE_THRESHOLD) {
		return { summary, detail: { kind: 'replace', before, after } };
	}
	return { summary, detail: { kind: 'chars', segments } };
}

/**
 * Markdown fields (descriptions). Diffed block by block so unchanged
 * paragraphs render as they are, added and removed blocks are marked whole,
 * and a paragraph edited in place gets word-level highlights.
 */
function presentMarkdown(summary: SummaryPart[], change: EntityChange): ChangeView {
	const before = typeof change.from === 'string' ? change.from : '';
	const after = typeof change.to === 'string' ? change.to : '';
	if (before === '' || after === '') {
		return {
			summary,
			detail: {
				kind: 'markdown-replace',
				beforeHtml: markdown(before),
				afterHtml: markdown(after)
			}
		};
	}

	const blocks = pairBlocks(diffSequences(splitBlocks(before), splitBlocks(after)));
	const touched = blocks.reduce((sum, block) => {
		if (block.kind === 'same') return sum;
		if (block.kind === 'changed')
			return sum + touchedShare(diffText(block.before, block.after));
		return sum + 1;
	}, 0);
	if (touched / blocks.length > TEXT_REWRITE_THRESHOLD) {
		return {
			summary,
			detail: {
				kind: 'markdown-replace',
				beforeHtml: markdown(before),
				afterHtml: markdown(after)
			}
		};
	}

	return {
		summary,
		detail: {
			kind: 'markdown',
			blocks: blocks.map((block) =>
				block.kind === 'changed'
					? { kind: 'changed', html: markdownWithHighlights(block.before, block.after) }
					: { kind: block.kind, html: markdown(block.text) }
			)
		}
	};
}

type PairedBlock =
	| { kind: 'same' | 'added' | 'removed'; text: string }
	| { kind: 'changed'; before: string; after: string };

/** A removed block directly followed by an added one that mostly matches it is one edited block. */
function pairBlocks(segments: DiffSegment[]): PairedBlock[] {
	const out: PairedBlock[] = [];
	for (let i = 0; i < segments.length; i++) {
		const current = segments[i];
		const next = segments[i + 1];
		if (current.kind === 'removed' && next?.kind === 'added') {
			const share = touchedShare(diffText(current.text, next.text));
			if (share <= TEXT_REWRITE_THRESHOLD) {
				out.push({ kind: 'changed', before: current.text, after: next.text });
				i++;
				continue;
			}
		}
		out.push({ kind: current.kind, text: current.text });
	}
	return out;
}

function splitBlocks(source: string): string[] {
	return source
		.replace(/\r\n/g, '\n')
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter((block) => block !== '');
}

function markdown(source: string): string {
	return marked.parse(source, { async: false }) as string;
}

// Word-level highlights inside one block: wrap changed runs in private-use
// sentinels, render the markdown, then swap the sentinels for ins and del.
const INS_OPEN = '\uE000';
const INS_CLOSE = '\uE001';
const DEL_OPEN = '\uE002';
const DEL_CLOSE = '\uE003';

function markdownWithHighlights(before: string, after: string): string {
	const source = diffText(before, after)
		.map((segment) => {
			if (segment.kind === 'added') return `${INS_OPEN}${segment.text}${INS_CLOSE}`;
			if (segment.kind === 'removed') return `${DEL_OPEN}${segment.text}${DEL_CLOSE}`;
			return segment.text;
		})
		.join('');
	return markdown(source)
		.replaceAll(INS_OPEN, '<ins>')
		.replaceAll(INS_CLOSE, '</ins>')
		.replaceAll(DEL_OPEN, '<del>')
		.replaceAll(DEL_CLOSE, '</del>');
}

/** Share of characters inside changed segments. */
function touchedShare(segments: DiffSegment[]): number {
	let touched = 0;
	let total = 0;
	for (const segment of segments) {
		total += segment.text.length;
		if (segment.kind !== 'same') touched += segment.text.length;
	}
	return total === 0 ? 0 : touched / total;
}

/**
 * Diff text as words, whitespace runs and single punctuation marks, merged
 * into runs. Prose diffs by word; a regex pattern (no whitespace, mostly
 * punctuation) effectively diffs by character.
 */
export function diffText(before: string, after: string): DiffSegment[] {
	const tokenize = (source: string): string[] => source.match(/\s+|\w+|[^\s\w]/gu) ?? [];
	const tokens = diffSequences(tokenize(before), tokenize(after), 'chars');

	// A removed run directly followed by an added run is a replaced span;
	// re-diff it by character so an edit inside a word shows as that edit.
	const out: DiffSegment[] = [];
	for (let i = 0; i < tokens.length; i++) {
		const current = tokens[i];
		const next = tokens[i + 1];
		if (current.kind === 'removed' && next?.kind === 'added') {
			for (const segment of diffSequences([...current.text], [...next.text], 'chars')) {
				const last = out.at(-1);
				if (last && last.kind === segment.kind) last.text += segment.text;
				else out.push({ ...segment });
			}
			i++;
			continue;
		}
		const last = out.at(-1);
		if (last && last.kind === current.kind) last.text += current.text;
		else out.push({ ...current });
	}
	return out;
}

// --- Sequence diff (LCS) ---

// Roughly 64 MB of DP table. Beyond it the inputs are re-diffed as lines,
// which is coarser but never degrades to "everything changed".
const MAX_CELLS = 16_000_000;

/**
 * Minimal edit script between two sequences. Line diffs keep one segment per
 * line; char diffs merge consecutive same-kind characters into runs.
 */
export function diffSequences(
	a: string[],
	b: string[],
	mode: 'lines' | 'chars' = 'lines'
): DiffSegment[] {
	const out: DiffSegment[] = [];
	const push = (kind: DiffSegment['kind'], text: string) => {
		const last = out.at(-1);
		if (mode === 'chars' && last && last.kind === kind) last.text += text;
		else out.push({ kind, text });
	};

	// Common prefix and suffix cost nothing to detect and shrink the table;
	// an append or a single edit then diffs in linear time.
	let prefix = 0;
	while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
	let suffix = 0;
	while (
		suffix < a.length - prefix &&
		suffix < b.length - prefix &&
		a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
	) {
		suffix++;
	}
	if (prefix > 0 || suffix > 0) {
		for (const text of a.slice(0, prefix)) push('same', text);
		const middle = diffSequences(
			a.slice(prefix, a.length - suffix),
			b.slice(prefix, b.length - suffix),
			mode
		);
		for (const segment of middle) push(segment.kind, segment.text);
		for (const text of a.slice(a.length - suffix)) push('same', text);
		return out;
	}

	if (a.length * b.length > MAX_CELLS) {
		const lines = (tokens: string[]) => tokens.join('').split(/(?<=\n)/);
		const lineA = lines(a);
		const lineB = lines(b);
		if (lineA.length * lineB.length > MAX_CELLS || lineA.length === a.length) {
			for (const text of a) push('removed', text);
			for (const text of b) push('added', text);
			return out;
		}
		return diffSequences(lineA, lineB, mode);
	}

	// lcs[i][j] = LCS length of a[i..] and b[j..]
	const cols = b.length + 1;
	const lcs = new Uint32Array((a.length + 1) * cols);
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			lcs[i * cols + j] =
				a[i] === b[j]
					? lcs[(i + 1) * cols + j + 1] + 1
					: Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + j + 1]);
		}
	}

	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			push('same', a[i]);
			i++;
			j++;
		} else if (lcs[(i + 1) * cols + j] >= lcs[i * cols + j + 1]) {
			push('removed', a[i]);
			i++;
		} else {
			push('added', b[j]);
			j++;
		}
	}
	while (i < a.length) push('removed', a[i++]);
	while (j < b.length) push('added', b[j++]);
	return out;
}

// --- Helpers ---

function parsePath(path: string): PathSegment[] {
	const segments: PathSegment[] = [];
	for (const match of path.matchAll(/([^.[\]]+)(?:\[([^\]]*)\])?/g)) {
		const [, key, item] = match;
		segments.push(item === undefined ? { key } : { key, item });
	}
	return segments;
}

function text(value: string): SummaryPart {
	return { kind: 'text', text: value };
}

function ref(name: string, entityType: string | null, ctx?: PresentContext): SummaryPart {
	const href =
		entityType !== null && ctx !== undefined && ctx.exists(entityType, name)
			? entityHref(ctx.database, entityType, name)
			: null;
	return { kind: 'ref', text: name, href };
}

function verb(change: EntityChange): string {
	return change.kind;
}

function lowerFirst(value: string): string {
	return value.charAt(0).toLowerCase() + value.slice(1);
}

function isScalar(value: unknown): boolean {
	return value === null || (typeof value !== 'object' && typeof value !== 'function');
}

function scalar(value: unknown): string {
	if (value === null || value === undefined) return 'none';
	if (typeof value === 'boolean') return value ? 'yes' : 'no';
	if (typeof value === 'string') return value === '' ? 'empty' : value;
	return String(value);
}

<script lang="ts">
	import {
		Clock,
		ExternalLink,
		FileText,
		Regex,
		Ruler,
		Settings,
		SlidersHorizontal,
		Tags
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import AdaptiveList from '$lib/client/ui/adaptive-list/AdaptiveList.svelte';
	import Badge from '$lib/client/ui/badge/Badge.svelte';
	import DateTime from '$lib/client/ui/datetime/DateTime.svelte';
	import type { Column } from '$lib/client/ui/table/types';
	import {
		formatEntityType,
		formatHistoryKind,
		type EntityHistoryItem
	} from '$lib/shared/utils/pcd/history';
	import type { ChangeDetail, ChangeView, SummaryPart } from '$lib/shared/utils/pcd/history-view';

	interface Props {
		history: EntityHistoryItem[];
	}

	let { history }: Props = $props();

	interface HistoryRow {
		[key: string]: unknown;
		ref: string;
		title: string;
		date: string;
		item: EntityHistoryItem;
	}

	const rows = $derived<HistoryRow[]>(
		history.map((item) => ({
			ref: item.shortHash ?? `#${item.op}`,
			title: item.title,
			date: item.date,
			item
		}))
	);

	const columns: Column<HistoryRow>[] = [
		{ key: 'ref', header: 'Commit', width: 'w-28' },
		{ key: 'title', header: 'Change' },
		{ key: 'date', header: 'Date', sortable: true, align: 'right', width: 'w-32' }
	];

	const kindColor: Record<EntityHistoryItem['kind'], 'success' | 'danger' | 'info'> = {
		created: 'success',
		deleted: 'danger',
		renamed: 'info',
		updated: 'info'
	};

	const inlineCode =
		'rounded-control-sm border border-border px-1.5 py-0.5 font-mono text-[0.875em]';

	const diffBox =
		'mt-1 rounded-control border border-border-subtle bg-surface px-3 py-2 font-mono text-xs leading-5';

	const proseBox =
		'prose rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm';

	// Word-level highlights inside an edited markdown block.
	const proseDiff =
		'[&_ins]:rounded-control-sm [&_ins]:bg-success-bg [&_ins]:text-success-text [&_ins]:no-underline [&_del]:rounded-control-sm [&_del]:bg-danger-bg [&_del]:text-danger-text';

	const blockClass = {
		same: '',
		added: 'rounded-control bg-success-bg px-3 py-1',
		removed: 'rounded-control bg-danger-bg px-3 py-1 line-through',
		changed: 'border-l-2 border-border pl-3'
	} as const;

	const toneClass = {
		added: 'border-success-border bg-success-bg text-success-text',
		removed: 'border-danger-border bg-danger-bg text-danger-text'
	} as const;

	const segmentClass = {
		same: '',
		added: 'bg-success-bg text-success-text',
		removed: 'bg-danger-bg text-danger-text line-through'
	} as const;

	function changeSummary(item: EntityHistoryItem): string {
		if (item.kind === 'created') return 'Entity created';
		if (item.kind === 'deleted') return 'Entity deleted';
		const count = item.changes.length;
		const base = count === 1 ? '1 change' : `${count} changes`;
		return item.kind === 'renamed' ? `Renamed from ${item.renamedFrom}, ${base}` : base;
	}

	// Same icons as the sidebar nav groups.
	const typeIcons: Record<
		string,
		Component<{ 'size'?: number; 'class'?: string; 'aria-label'?: string }>
	> = {
		quality_profile: SlidersHorizontal,
		custom_format: Tags,
		regular_expression: Regex,
		delay_profile: Clock,
		radarr_naming: FileText,
		sonarr_naming: FileText,
		radarr_media_settings: Settings,
		sonarr_media_settings: Settings,
		radarr_quality_definitions: Ruler,
		sonarr_quality_definitions: Ruler
	};

	function hasDetails(item: EntityHistoryItem): boolean {
		return item.changes.length > 0 || item.related.length > 0 || item.kind === 'renamed';
	}
</script>

{#snippet commitLink(item: EntityHistoryItem)}
	{#if item.commitUrl}
		<a
			href={item.commitUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-1 font-mono text-sm text-link-text hover:underline"
			onclick={(event) => event.stopPropagation()}>
			{item.shortHash}
			<ExternalLink
				size={12}
				aria-hidden="true" />
		</a>
	{:else}
		<span class="font-mono text-sm text-text-muted">#{item.op}</span>
	{/if}
{/snippet}

{#snippet kindBadge(item: EntityHistoryItem)}
	{#if item.kind !== 'updated'}
		<Badge
			color={kindColor[item.kind]}
			variant="subtle"
			pill>{formatHistoryKind(item.kind)}</Badge>
	{/if}
{/snippet}

<!-- Entity names render like prose inline code (src/styles/prose.css). -->
{#snippet summary(parts: SummaryPart[])}
	{#each parts as part, index (index)}
		{#if part.kind === 'text'}
			{part.text}
		{:else if part.href && part.external}
			<a
				href={part.href}
				target="_blank"
				rel="noopener noreferrer"
				class="{inlineCode} text-link-text hover:underline">{part.text}</a>
		{:else if part.href}
			<a
				href={part.href}
				class="{inlineCode} text-link-text hover:underline">{part.text}</a>
		{:else}
			<span class="{inlineCode} {part.tone ? toneClass[part.tone] : 'text-text-soft'}"
				>{part.text}</span>
		{/if}
	{/each}
{/snippet}

{#snippet detail(view: ChangeDetail)}
	{#if view.kind === 'lines'}
		<pre class="{diffBox} whitespace-pre-wrap">{#each view.lines as line, index (index)}<span
					class="block {segmentClass[line.kind]}"
					>{line.kind === 'added'
						? '+'
						: line.kind === 'removed'
							? '-'
							: ' '} {line.text}</span
				>{/each}</pre>
	{:else if view.kind === 'chars'}
		<p class="{diffBox} break-all whitespace-pre-wrap">
			{#each view.segments as segment, index (index)}<span class={segmentClass[segment.kind]}
					>{segment.text}</span
				>{/each}
		</p>
	{:else if view.kind === 'markdown'}
		<div class="{proseDiff} mt-1 space-y-2">
			{#each view.blocks as block, index (index)}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- markdown parsed at build time -->
				<div class="prose text-sm {blockClass[block.kind]}">{@html block.html}</div>
			{/each}
		</div>
	{:else if view.kind === 'markdown-replace'}
		<div class="mt-1 grid gap-2 sm:grid-cols-2">
			<div>
				<p class="mb-1 text-xs text-text-muted">Before</p>
				<div class="{proseBox} {view.beforeHtml === '' ? 'italic' : ''}">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- markdown parsed at build time -->
					{@html view.beforeHtml || 'empty'}
				</div>
			</div>
			<div>
				<p class="mb-1 text-xs text-text-muted">After</p>
				<div class="{proseBox} {view.afterHtml === '' ? 'italic' : ''}">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- markdown parsed at build time -->
					{@html view.afterHtml || 'empty'}
				</div>
			</div>
		</div>
	{:else}
		<div class="mt-1 grid gap-2 sm:grid-cols-2">
			<div>
				<p class="mb-1 text-xs text-text-muted">Before</p>
				<pre
					class="{diffBox} mt-0 break-words whitespace-pre-wrap {view.before === ''
						? 'italic'
						: ''}">{view.before === '' ? 'empty' : view.before}</pre>
			</div>
			<div>
				<p class="mb-1 text-xs text-text-muted">After</p>
				<pre
					class="{diffBox} mt-0 break-words whitespace-pre-wrap {view.after === ''
						? 'italic'
						: ''}">{view.after === '' ? 'empty' : view.after}</pre>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet change(view: ChangeView)}
	<li class="text-sm">
		{@render summary(view.summary)}
		{#if view.detail}
			{@render detail(view.detail)}
		{/if}
	</li>
{/snippet}

{#snippet details(item: EntityHistoryItem)}
	{#if item.kind === 'renamed'}
		<p class="text-sm">
			<span class="text-text-muted">Renamed from</span>
			<span class="{inlineCode} text-text-soft">{item.renamedFrom}</span>
		</p>
	{/if}
	{#if item.changes.length > 0}
		<ul class="space-y-2">
			{#each item.changes as view, index (index)}
				{@render change(view)}
			{/each}
		</ul>
	{/if}
	{#if item.related.length > 0}
		<div class="mt-4">
			<p class="mb-1 text-sm text-text-muted">Also changed in this commit</p>
			<ul class="space-y-1">
				{#each item.related as link (link.href)}
					{@const TypeIcon = typeIcons[link.entityType]}
					<li class="flex items-center gap-2">
						{#if TypeIcon}
							<TypeIcon
								size={14}
								class="shrink-0 text-text-muted"
								aria-label={formatEntityType(link.entityType)} />
						{/if}
						<a
							href={link.href}
							title={formatEntityType(link.entityType)}
							class="text-sm text-link-text hover:underline">{link.label}</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{/snippet}

{#if history.length === 0}
	<p class="mt-4 text-sm text-text-muted italic">No recorded history.</p>
{:else}
	<div class="mt-4">
		<AdaptiveList
			data={rows}
			{columns}>
			{#snippet cell(row, column)}
				{#if column.key === 'ref'}
					{@render commitLink(row.item)}
				{:else if column.key === 'title'}
					<span class="inline-flex flex-wrap items-center gap-2">
						<span class="font-medium">{row.title}</span>
						{@render kindBadge(row.item)}
					</span>
				{:else if column.key === 'date'}
					<DateTime
						date={row.date}
						format="numeric"
						class="text-text-muted" />
				{/if}
			{/snippet}
			{#snippet expanded(row)}
				{#if hasDetails(row.item)}
					{@render details(row.item)}
				{/if}
			{/snippet}
			{#snippet card(row)}
				<div class="flex items-start justify-between gap-3">
					<p class="text-sm font-medium">{row.title}</p>
					{@render kindBadge(row.item)}
				</div>
				<div class="mt-2 flex items-center justify-between text-sm text-text-muted">
					{@render commitLink(row.item)}
					<DateTime
						date={row.date}
						format="numeric" />
				</div>
				<p class="mt-2 text-sm text-text-muted">{changeSummary(row.item)}</p>
			{/snippet}
		</AdaptiveList>
	</div>
{/if}

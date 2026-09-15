<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';
	import AdaptiveList from '$lib/client/ui/adaptive-list/AdaptiveList.svelte';
	import Badge from '$lib/client/ui/badge/Badge.svelte';
	import DateTime from '$lib/client/ui/datetime/DateTime.svelte';
	import type { Column } from '$lib/client/ui/table/types';
	import {
		formatChangePath,
		formatChangeValue,
		formatHistoryKind,
		type EntityHistoryItem
	} from '$lib/shared/utils/pcd/history';
	import type { EntityChange } from '$lib/types/pcd';

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
		{ key: 'date', header: 'Date', sortable: true, align: 'right', width: 'w-40' }
	];

	const kindColor: Record<EntityHistoryItem['kind'], 'success' | 'danger' | 'info'> = {
		created: 'success',
		deleted: 'danger',
		renamed: 'info',
		updated: 'info'
	};

	function changeSummary(item: EntityHistoryItem): string {
		if (item.kind === 'created') return 'Entity created';
		if (item.kind === 'deleted') return 'Entity deleted';
		const count = item.changes.length;
		const base = count === 1 ? '1 change' : `${count} changes`;
		return item.kind === 'renamed' ? `Renamed from ${item.renamedFrom}, ${base}` : base;
	}

	function isMono(change: EntityChange): boolean {
		return change.path === 'pattern' || change.path.startsWith('formats');
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

{#snippet changeValue(change: EntityChange)}
	<span class="text-sm {isMono(change) ? 'font-mono break-all' : ''}">
		{#if change.kind === 'added'}
			<span class="text-success-text">{formatChangeValue(change.to)}</span>
		{:else if change.kind === 'removed'}
			<span class="text-danger-text line-through">{formatChangeValue(change.from)}</span>
		{:else}
			<span class="text-danger-text line-through">{formatChangeValue(change.from)}</span>
			<span
				class="text-text-muted"
				aria-hidden="true">→</span>
			<span class="sr-only">to</span>
			<span class="text-success-text">{formatChangeValue(change.to)}</span>
		{/if}
	</span>
{/snippet}

{#snippet details(item: EntityHistoryItem)}
	{#if item.kind === 'renamed'}
		<p class="text-sm">
			<span class="text-text-muted">Renamed from</span>
			<span class="font-medium">{item.renamedFrom}</span>
		</p>
	{/if}
	{#if item.changes.length > 0}
		<dl class="space-y-2">
			{#each item.changes as change (change.path + change.kind)}
				<div
					class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
					<dt class="shrink-0 text-sm text-text-muted">
						{formatChangePath(change.path)}
					</dt>
					<dd class="text-right">{@render changeValue(change)}</dd>
				</div>
			{/each}
		</dl>
	{/if}
	{#if item.related.length > 0}
		<div class="mt-4">
			<p class="mb-1 text-sm text-text-muted">Also changed in this commit</p>
			<ul class="flex flex-wrap gap-x-4 gap-y-1">
				{#each item.related as link (link.href)}
					<li>
						<a
							href={link.href}
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
						class="text-text-muted" />
				{/if}
			{/snippet}
			{#snippet expanded(row)}
				{#if row.item.changes.length > 0 || row.item.related.length > 0 || row.item.kind === 'renamed'}
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
					<DateTime date={row.date} />
				</div>
				<p class="mt-2 text-sm text-text-muted">{changeSummary(row.item)}</p>
			{/snippet}
		</AdaptiveList>
	</div>
{/if}

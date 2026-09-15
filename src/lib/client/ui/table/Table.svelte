<script
	lang="ts"
	generics="T extends Record<string, unknown>">
	import { goto } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { ChevronUp, ChevronDown, ChevronRight } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import type { Column } from './types';
	import Button from '$lib/client/ui/button/Button.svelte';

	interface Props {
		data: T[];
		columns: Column<T>[];
		href?: (row: T) => string | undefined;
		cell?: Snippet<[row: T, column: Column<T>]>;
		expanded?: Snippet<[row: T]>;
	}

	let { data, columns, href, cell, expanded }: Props = $props();

	let sortKey = $state<string | null>(null);
	let sortDir = $state<'asc' | 'desc'>('asc');
	let expandedRows = new SvelteSet<number>();
	let probeContainer = $state<HTMLElement | null>(null);
	let expandableSet = new SvelteSet<number>();

	function toggleSort(key: string) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	function toggleExpand(index: number) {
		if (!expandableSet.has(index)) return;
		if (expandedRows.has(index)) {
			expandedRows.delete(index);
		} else {
			expandedRows.add(index);
		}
	}

	const sorted = $derived.by(() => {
		if (!sortKey) return data;
		const key = sortKey;
		const dir = sortDir === 'asc' ? 1 : -1;
		return [...data].sort((a, b) => {
			const av = a[key];
			const bv = b[key];
			if (av == null && bv == null) return 0;
			if (av == null) return 1;
			if (bv == null) return -1;
			if (typeof av === 'string' && typeof bv === 'string') {
				return av.localeCompare(bv) * dir;
			}
			return ((av as number) - (bv as number)) * dir;
		});
	});

	// New data means new rows: nothing stays open across a navigation that
	// reuses this component, and the expandable probe is rebuilt from scratch.
	$effect(() => {
		void data;
		expandedRows.clear();
	});

	$effect(() => {
		const _rows = sorted;
		if (!probeContainer) return;

		expandableSet.clear();
		const children = probeContainer.children;
		for (let i = 0; i < _rows.length; i++) {
			if (children[i]?.childElementCount > 0) {
				expandableSet.add(i);
			}
		}
	});

	const colCount = $derived(columns.length + (expanded ? 1 : 0));

	// A linked row navigates; otherwise an expandable row toggles.
	function rowClick(row: T, index: number) {
		const url = href?.(row);
		if (url) {
			goto(url);
			return;
		}
		toggleExpand(index);
	}

	function isInteractive(row: T, index: number): boolean {
		return Boolean(href?.(row)) || expandableSet.has(index);
	}
</script>

{#if expanded}
	<div
		class="hidden"
		bind:this={probeContainer}>
		{#each sorted as row, i (i)}
			<div>{@render expanded(row)}</div>
		{/each}
	</div>
{/if}

{#snippet headerLabel(col: Column<T>)}
	{#if col.icon}
		<img
			src={col.icon.src}
			alt={col.icon.alt}
			class="size-4" />
	{/if}
	{col.header}
{/snippet}

<!-- lint-disable no-raw-ui -->
<div class="overflow-hidden rounded-card border border-border bg-surface-muted shadow-card">
	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class="border-b border-border bg-surface">
				{#each columns as col (col.key)}
					<th
						class="px-4 py-3 font-medium text-text-muted {col.align === 'center'
							? 'text-center'
							: col.align === 'right'
								? 'text-right'
								: 'text-left'} {col.width ?? ''}">
						{#if col.sortable}
							<button
								type="button"
								class="inline-flex items-center gap-1 transition-colors hover:text-text"
								onclick={() => toggleSort(col.key)}>
								{@render headerLabel(col)}
								{#if sortKey === col.key}
									{#if sortDir === 'asc'}
										<ChevronUp size={14} />
									{:else}
										<ChevronDown size={14} />
									{/if}
								{/if}
							</button>
						{:else}
							<span class="inline-flex items-center gap-1">
								{@render headerLabel(col)}
							</span>
						{/if}
					</th>
				{/each}
				{#if expanded}
					<th class="w-8"></th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each sorted as row, idx (idx)}
				<tr
					class="border-b border-border-subtle last:border-b-0 {isInteractive(row, idx)
						? 'cursor-pointer transition-colors hover:bg-surface-hover'
						: ''}"
					onclick={() => rowClick(row, idx)}>
					{#each columns as col (col.key)}
						<td
							class="px-4 py-3 {col.align === 'center'
								? 'text-center'
								: col.align === 'right'
									? 'text-right'
									: 'text-left'}">
							{#if cell}
								{@render cell(row, col)}
							{:else}
								{row[col.key] ?? ''}
							{/if}
						</td>
					{/each}
					{#if expanded}
						<td class="px-2 py-3 text-center">
							{#if expandableSet.has(idx)}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									icon={ChevronRight}
									iconClass="transition-transform {expandedRows.has(idx)
										? 'rotate-90'
										: ''}"
									onclick={(e: MouseEvent) => {
										e.stopPropagation();
										toggleExpand(idx);
									}} />
							{/if}
						</td>
					{/if}
				</tr>
				{#if expanded && expandedRows.has(idx) && expandableSet.has(idx)}
					<tr class="border-b border-border-subtle last:border-b-0">
						<td
							colspan={colCount}
							class="bg-surface px-4 py-4">
							{@render expanded(row)}
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</div>

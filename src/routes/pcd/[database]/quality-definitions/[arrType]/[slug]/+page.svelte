<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import EntityHistory from '$lib/client/pcd/EntityHistory.svelte';
	import EntityView from '$lib/client/pcd/EntityView.svelte';
	import AdaptiveList from '$lib/client/ui/adaptive-list/AdaptiveList.svelte';
	import Badge from '$lib/client/ui/badge/Badge.svelte';
	import DropdownSelect from '$lib/client/ui/dropdown/DropdownSelect.svelte';
	import PageHeader from '$lib/client/ui/header/PageHeader.svelte';
	import PageActionsMenu from '$lib/client/ui/page-actions/PageActionsMenu.svelte';
	import type { PageFormatAction } from '$lib/client/ui/page-actions/types';
	import SEO from '$lib/client/ui/utils/SEO.svelte';
	import {
		TIER_SIZE_UNIT_LABELS,
		formatTierSize,
		formatTierMaxSize,
		type TierSizeUnit
	} from '$lib/shared/utils/pcd/format';
	import { tierSizeUnit } from '$lib/client/pcd/tier-size-unit.svelte';
	import type { Column } from '$lib/client/ui/table/types';

	let { data } = $props();
	const config = $derived(data.config);

	const unit = $derived(tierSizeUnit.current);

	onMount(() => {
		tierSizeUnit.init();
	});

	const unitOptions = Object.entries(TIER_SIZE_UNIT_LABELS).map(([value, label]) => ({
		value,
		label
	}));

	interface TierRow {
		id: string;
		quality: string;
		min: string;
		preferred: string;
		max: string;
		[key: string]: unknown;
	}

	const rows = $derived<TierRow[]>(
		config.tiers.map((tier) => ({
			id: tier.qualityName,
			quality: tier.qualityName,
			min: formatTierSize(tier.minSize, unit),
			preferred: formatTierSize(tier.preferredSize, unit),
			max: formatTierMaxSize(tier.maxSize, unit, data.arrType)
		}))
	);

	const columns: Column<TierRow>[] = [
		{ key: 'quality', header: 'Quality' },
		{ key: 'min', header: 'Min', align: 'right' },
		{ key: 'preferred', header: 'Preferred', align: 'right' },
		{ key: 'max', header: 'Max', align: 'right' }
	];

	const formatActions = $derived.by((): PageFormatAction[] => {
		const yamlPath = `${page.url.pathname}.yaml`;
		return [
			{
				kind: 'copy',
				label: 'Copy as YAML',
				successLabel: 'YAML copied',
				url: yamlPath
			},
			{
				kind: 'download',
				label: 'Download as YAML',
				url: yamlPath,
				filename: `${page.params.slug}.yaml`
			}
		];
	});
</script>

<SEO title={config.name} />

<PageHeader title={config.name}>
	{#snippet actions()}
		<PageActionsMenu
			{formatActions}
			artifactPath="{page.url.pathname}.md"
			pagePath={page.url.pathname}
			viewSwitcher />
	{/snippet}
</PageHeader>

<EntityView yamlPath="{page.url.pathname}.yaml">
	{#snippet rich()}
		<div class="mt-8 flex items-end justify-between gap-4 border-b border-border-muted pb-2">
			<h2
				id="quality-tiers"
				class="text-xl font-bold">
				Quality Tiers
			</h2>
			<DropdownSelect
				value={unit}
				options={unitOptions}
				header="Size unit"
				position="right"
				onchange={(value) => tierSizeUnit.set(value as TierSizeUnit)} />
		</div>
		<div class="mt-4">
			<AdaptiveList
				data={rows}
				{columns}>
				{#snippet cell(row, col)}
					{#if col.key === 'quality'}
						<span class="font-medium">{row.quality}</span>
					{:else}
						<Badge variant="outline">{row[col.key]}</Badge>
					{/if}
				{/snippet}
				{#snippet card(row)}
					<p class="text-sm font-medium">{row.quality}</p>
					<dl class="mt-2 space-y-1 text-sm">
						<div class="flex items-center justify-between">
							<dt class="text-text-muted">Min</dt>
							<dd><Badge variant="outline">{row.min}</Badge></dd>
						</div>
						<div class="flex items-center justify-between">
							<dt class="text-text-muted">Preferred</dt>
							<dd><Badge variant="outline">{row.preferred}</Badge></dd>
						</div>
						<div class="flex items-center justify-between">
							<dt class="text-text-muted">Max</dt>
							<dd><Badge variant="outline">{row.max}</Badge></dd>
						</div>
					</dl>
				{/snippet}
			</AdaptiveList>
		</div>

		<h2
			id="history"
			class="mt-8 border-b border-border-muted pb-2 text-xl font-bold">
			History
		</h2>
		<EntityHistory history={data.history} />
	{/snippet}
</EntityView>

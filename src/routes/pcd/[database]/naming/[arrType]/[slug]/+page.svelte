<script lang="ts">
	import { page } from '$app/state';
	import EntityHistory from '$lib/client/pcd/EntityHistory.svelte';
	import EntityView from '$lib/client/pcd/EntityView.svelte';
	import AdaptiveList from '$lib/client/ui/adaptive-list/AdaptiveList.svelte';
	import Badge from '$lib/client/ui/badge/Badge.svelte';
	import PageHeader from '$lib/client/ui/header/PageHeader.svelte';
	import PageActionsMenu from '$lib/client/ui/page-actions/PageActionsMenu.svelte';
	import type { PageFormatAction } from '$lib/client/ui/page-actions/types';
	import SEO from '$lib/client/ui/utils/SEO.svelte';
	import {
		NAMING_FORMAT_LABELS,
		COLON_REPLACEMENT_LABELS,
		MULTI_EPISODE_LABELS
	} from '$lib/shared/utils/pcd/format';
	import type { Column } from '$lib/client/ui/table/types';

	let { data } = $props();
	const naming = $derived(data.naming);
	const isSonarr = $derived(naming.arrType === 'sonarr');

	const formatEntries = $derived(
		Object.entries(naming.formats)
			.filter(([key]) => key !== 'multiEpisodeStyle')
			.map(([key, value]) => ({
				label: NAMING_FORMAT_LABELS[key] ?? key,
				value
			}))
	);

	const multiEpisodeStyle = $derived(isSonarr ? naming.formats.multiEpisodeStyle : null);

	interface SettingRow {
		id: string;
		setting: string;
		value: string;
		[key: string]: unknown;
	}

	const rows = $derived<SettingRow[]>([
		{
			id: 'rename',
			setting: 'Rename',
			value: naming.rename ? 'Yes' : 'No'
		},
		{
			id: 'character-replacement',
			setting: 'Character Replacement',
			value: naming.replaceIllegalCharacters ? 'Yes' : 'No'
		},
		...(multiEpisodeStyle
			? [
					{
						id: 'multi-episode',
						setting: 'Multi-Episode Style',
						value: MULTI_EPISODE_LABELS[multiEpisodeStyle] ?? multiEpisodeStyle
					}
				]
			: [])
	]);

	const columns: Column<SettingRow>[] = [
		{ key: 'setting', header: 'Setting' },
		{ key: 'value', header: 'Value' }
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

<SEO title={naming.name} />

<PageHeader title={naming.name}>
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
		<h2
			id="configuration"
			class="mt-8 border-b border-border-muted pb-2 text-xl font-bold">
			Configuration
		</h2>
		<div class="mt-4">
			<AdaptiveList
				data={rows}
				{columns}>
				{#snippet cell(row, col)}
					{#if col.key === 'setting'}
						<span class="font-medium">{row.setting}</span>
					{:else if col.key === 'value'}
						{#if row.id === 'multi-episode'}
							<Badge
								color="info"
								variant="subtle"
								pill>{row.value}</Badge>
						{:else}
							<Badge
								color={row.value === 'Yes' ? 'success' : 'neutral'}
								variant="subtle"
								pill>
								{row.value}
							</Badge>
						{/if}
					{/if}
				{/snippet}
				{#snippet expanded(row)}
					{#if row.id === 'character-replacement' && naming.replaceIllegalCharacters}
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-sm text-text-muted">Colon Replacement</span>
								<Badge
									color="info"
									variant="subtle"
									size="sm"
									pill>
									{COLON_REPLACEMENT_LABELS[naming.colonReplacementFormat] ??
										naming.colonReplacementFormat}
								</Badge>
							</div>
							{#if naming.colonReplacementFormat === 'custom' && naming.customColonReplacementFormat}
								<div class="flex items-center justify-between">
									<span class="text-sm text-text-muted">Custom Replacement</span>
									<span class="font-mono text-sm font-medium">
										{naming.customColonReplacementFormat}
									</span>
								</div>
							{/if}
						</div>
					{/if}
				{/snippet}
				{#snippet card(row)}
					<p class="text-sm font-medium">{row.setting}</p>
					<div class="mt-2">
						{#if row.id === 'multi-episode'}
							<Badge
								color="info"
								variant="subtle"
								pill>{row.value}</Badge>
						{:else}
							<Badge
								color={row.value === 'Yes' ? 'success' : 'neutral'}
								variant="subtle"
								pill>
								{row.value}
							</Badge>
						{/if}
						{#if row.id === 'character-replacement' && naming.replaceIllegalCharacters}
							<div class="mt-3 space-y-1">
								<div class="flex items-center justify-between text-sm">
									<span class="text-text-muted">Colon Replacement</span>
									<Badge
										color="info"
										variant="subtle"
										size="sm"
										pill>
										{COLON_REPLACEMENT_LABELS[naming.colonReplacementFormat] ??
											naming.colonReplacementFormat}
									</Badge>
								</div>
								{#if naming.colonReplacementFormat === 'custom' && naming.customColonReplacementFormat}
									<div class="flex items-center justify-between text-sm">
										<span class="text-text-muted">Custom Replacement</span>
										<span class="font-mono font-medium">
											{naming.customColonReplacementFormat}
										</span>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/snippet}
			</AdaptiveList>
		</div>

		<h2
			id="naming-scheme"
			class="mt-8 border-b border-border-muted pb-2 text-xl font-bold">
			Naming Scheme
		</h2>
		<div class="mt-4 space-y-4">
			{#each formatEntries as entry (entry.label)}
				<div>
					<p class="mb-2 text-sm font-medium text-text-muted">{entry.label}</p>
					<div
						class="overflow-x-auto rounded-card border border-border bg-surface-muted px-4 py-3">
						<code class="text-sm break-all">{entry.value}</code>
					</div>
				</div>
			{/each}
		</div>

		<h2
			id="history"
			class="mt-8 border-b border-border-muted pb-2 text-xl font-bold">
			History
		</h2>
		<EntityHistory history={data.history} />
	{/snippet}
</EntityView>

<script lang="ts">
	import { page } from '$app/state';
	import EntityHistory from '$lib/client/pcd/EntityHistory.svelte';
	import EntityView from '$lib/client/pcd/EntityView.svelte';
	import AdaptiveList from '$lib/client/ui/adaptive-list/AdaptiveList.svelte';
	import Badge from '$lib/client/ui/badge/Badge.svelte';
	import PageHeader from '$lib/client/ui/header/PageHeader.svelte';
	import CodeBlock from '$lib/client/ui/markdown/code/CodeBlock.svelte';
	import PageActionsMenu from '$lib/client/ui/page-actions/PageActionsMenu.svelte';
	import type { PageFormatAction } from '$lib/client/ui/page-actions/types';
	import SEO from '$lib/client/ui/utils/SEO.svelte';
	import type { Column } from '$lib/client/ui/table/types';
	import { FlaskConical, Regex } from '@lucide/svelte';

	let { data } = $props();
	const regex = $derived(data.regex);
	const descriptionHtml = $derived(data.descriptionHtml);
	const references = $derived(data.references);
	const database = $derived(data.database);

	const refColumns: Column<{ name: string; slug: string; tags: string[] }>[] = [
		{ key: 'name', header: 'Custom Format', sortable: true },
		{ key: 'tags', header: 'Tags' }
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

<SEO
	title={regex.name}
	description={regex.description ?? undefined} />

<PageHeader
	title={regex.name}
	tags={regex.tags}>
	{#snippet actions()}
		{#if regex.regex101Id}
			<a
				href="https://regex101.com/r/{regex.regex101Id}"
				target="_blank"
				rel="noopener noreferrer">
				<Badge
					variant="outline"
					icon={FlaskConical}
					iconColor="text-info-icon"
					link
					pill>regex101</Badge>
			</a>
		{/if}
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
			id="pattern"
			class="mt-8 border-b border-border-muted pb-2 text-xl font-bold">
			Pattern
		</h2>
		<div class="mt-4">
			<CodeBlock
				items={[{ title: 'Pattern', code: regex.pattern, language: 'text', icon: Regex }]}
				overflow="wrap" />
		</div>

		<h2
			id="description"
			class="mt-8 border-b border-border-muted pb-2 text-xl font-bold">
			Description
		</h2>
		{#if descriptionHtml}
			<div class="prose mt-2">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- markdown parsed at build time -->
				{@html descriptionHtml}
			</div>
		{:else}
			<p class="mt-2 text-sm text-text-muted italic">{regex.noDescriptionMessage}</p>
		{/if}

		<h2
			id="references"
			class="mt-8 border-b border-border-muted pb-2 text-xl font-bold">
			References
		</h2>
		{#if references.length > 0}
			<div class="mt-4">
				<AdaptiveList
					data={references}
					columns={refColumns}
					href={(row) => `/pcd/${database}/custom-formats/${row.slug}`}>
					{#snippet cell(row, col)}
						{#if col.key === 'name'}
							<span class="font-medium">{row.name}</span>
						{:else if col.key === 'tags'}
							<div class="flex flex-wrap gap-1">
								{#each row.tags as tag (tag)}
									<Badge
										size="sm"
										pill>{tag}</Badge>
								{/each}
							</div>
						{/if}
					{/snippet}
					{#snippet card(row)}
						<p class="text-sm font-medium">{row.name}</p>
						{#if row.tags.length > 0}
							<div class="mt-2 flex flex-wrap gap-1">
								{#each row.tags as tag (tag)}
									<Badge
										size="sm"
										pill>{tag}</Badge>
								{/each}
							</div>
						{/if}
					{/snippet}
				</AdaptiveList>
			</div>
		{:else}
			<p class="mt-4 text-sm text-text-muted italic">
				No custom formats reference this regex.
			</p>
		{/if}

		<h2
			id="history"
			class="mt-8 border-b border-border-muted pb-2 text-xl font-bold">
			History
		</h2>
		<EntityHistory history={data.history} />
	{/snippet}
</EntityView>

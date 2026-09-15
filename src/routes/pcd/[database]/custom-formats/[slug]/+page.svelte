<script lang="ts">
	import { page } from '$app/state';
	import {
		BookOpen,
		CalendarDays,
		Flag,
		HardDrive,
		Languages,
		Monitor,
		Radio,
		Regex,
		ScanText,
		SlidersHorizontal,
		Tags,
		Users
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import EntityView from '$lib/client/pcd/EntityView.svelte';
	import AdaptiveList from '$lib/client/ui/adaptive-list/AdaptiveList.svelte';
	import Badge from '$lib/client/ui/badge/Badge.svelte';
	import PageActionsMenu from '$lib/client/ui/page-actions/PageActionsMenu.svelte';
	import type { PageFormatAction } from '$lib/client/ui/page-actions/types';
	import PageHeader from '$lib/client/ui/header/PageHeader.svelte';
	import type { Column } from '$lib/client/ui/table/types';
	import SEO from '$lib/client/ui/utils/SEO.svelte';
	import { formatConditionType, formatConditionValue } from '$lib/shared/utils/pcd/format';
	import {
		formatProfileScore,
		type QualityProfileReference
	} from '$lib/shared/utils/pcd/references';
	import type { ConditionType } from '$lib/types/pcd';

	let { data } = $props();
	const format = $derived(data.format);
	const descriptionHtml = $derived(data.descriptionHtml);
	const references = $derived(data.references);
	const referenceColumns: Column<QualityProfileReference>[] = [
		{ key: 'name', header: 'Quality Profile', sortable: true },
		{ key: 'scores', header: 'Score' }
	];

	interface ConditionRow {
		[key: string]: unknown;
		name: string;
		type: ConditionType;
		typeLabel: string;
		value: string;
		regularExpressionHref: string | undefined;
		radarr: boolean;
		sonarr: boolean;
		required: boolean;
		negated: boolean;
	}

	const conditionIcons: Record<ConditionType, Component> = {
		release_title: ScanText,
		release_group: Users,
		edition: BookOpen,
		language: Languages,
		source: Radio,
		resolution: Monitor,
		quality_modifier: SlidersHorizontal,
		release_type: Tags,
		indexer_flag: Flag,
		size: HardDrive,
		year: CalendarDays
	};

	const conditionRows = $derived.by((): ConditionRow[] =>
		format.conditions.map((condition) => ({
			name: condition.name,
			type: condition.type,
			typeLabel: formatConditionType(condition.type),
			value: formatConditionValue(condition.data),
			regularExpressionHref: condition.regularExpressionSlug
				? `/pcd/${page.params.database}/regular-expressions/${condition.regularExpressionSlug}`
				: undefined,
			radarr: condition.arrType === 'all' || condition.arrType === 'radarr',
			sonarr: condition.arrType === 'all' || condition.arrType === 'sonarr',
			required: condition.required,
			negated: condition.negate
		}))
	);

	const conditionColumns: Column<ConditionRow>[] = [
		{ key: 'name', header: 'Name', sortable: true },
		{ key: 'typeLabel', header: 'Type', sortable: true },
		{ key: 'value', header: 'Value' },
		{ key: 'radarr', header: 'Applies to' },
		{ key: 'required', header: 'Flags' }
	];

	function scoreClass(score: number): string {
		if (score > 0) return 'text-success-text';
		if (score < 0) return 'text-danger-text';
		return 'text-text-muted';
	}

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

{#snippet conditionType(row: ConditionRow)}
	{@const TypeIcon = conditionIcons[row.type]}
	<span class="inline-flex items-center gap-1.5 text-text-muted">
		<TypeIcon
			size={16}
			aria-hidden="true" />
		<span>{row.typeLabel}</span>
	</span>
{/snippet}

{#snippet conditionValue(row: ConditionRow)}
	{#if row.regularExpressionHref}
		<a
			href={row.regularExpressionHref}
			aria-label="View regular expression: {row.value}"
			class="inline-flex items-center gap-1.5 rounded-control-sm font-medium text-link-text underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current focus-visible:decoration-current focus-visible:ring-2 focus-visible:ring-accent-border focus-visible:outline-none">
			<Regex
				size={16}
				aria-hidden="true" />
			<span>{row.value}</span>
		</a>
	{:else}
		<span class="font-medium">{row.value}</span>
	{/if}
{/snippet}

{#snippet conditionApps(row: ConditionRow)}
	<span class="inline-flex items-center gap-2">
		{#if row.radarr}
			<img
				src="/radarr.svg"
				alt="Radarr"
				class="size-5" />
		{/if}
		{#if row.sonarr}
			<img
				src="/sonarr.svg"
				alt="Sonarr"
				class="size-5" />
		{/if}
	</span>
{/snippet}

{#snippet conditionFlags(row: ConditionRow)}
	<span class="inline-flex flex-wrap gap-2">
		<Badge
			color={row.required ? 'info' : 'neutral'}
			variant="solid">
			{row.required ? 'Required' : 'Optional'}
		</Badge>
		{#if row.negated}
			<Badge
				color="danger"
				variant="solid">Negated</Badge>
		{/if}
	</span>
{/snippet}

{#snippet scoreValue(score: number)}
	<span class="text-sm font-medium tabular-nums {scoreClass(score)}">
		{formatProfileScore(score)}
	</span>
{/snippet}

{#snippet scoreList(reference: QualityProfileReference)}
	<div class="flex flex-wrap items-center gap-3">
		{#if reference.scores.radarr !== null && reference.scores.radarr === reference.scores.sonarr}
			<span class="inline-flex items-center gap-1.5">
				<img
					src="/radarr.svg"
					alt="Radarr"
					class="size-5" />
				<img
					src="/sonarr.svg"
					alt="Sonarr"
					class="size-5" />
				{@render scoreValue(reference.scores.radarr)}
			</span>
		{:else}
			{#if reference.scores.radarr !== null}
				<span class="inline-flex items-center gap-1.5">
					<img
						src="/radarr.svg"
						alt="Radarr"
						class="size-5" />
					{@render scoreValue(reference.scores.radarr)}
				</span>
			{/if}
			{#if reference.scores.sonarr !== null}
				<span class="inline-flex items-center gap-1.5">
					<img
						src="/sonarr.svg"
						alt="Sonarr"
						class="size-5" />
					{@render scoreValue(reference.scores.sonarr)}
				</span>
			{/if}
		{/if}
	</div>
{/snippet}

<SEO
	title={format.name}
	description={format.description ?? undefined} />

{#snippet renameBadge()}
	<Badge
		color="info"
		variant="solid">Included in Rename</Badge>
{/snippet}

<PageHeader
	title={format.name}
	tags={format.tags}
	badges={format.includeInRename ? renameBadge : undefined}>
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
		<section aria-labelledby="description">
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
				<p class="mt-2 text-sm text-text-muted italic">{format.noDescriptionMessage}</p>
			{/if}
		</section>

		<section aria-labelledby="conditions">
			<h2
				id="conditions"
				class="mt-8 border-b border-border-muted pb-2 text-xl font-bold">
				Conditions
			</h2>
			{#if conditionRows.length > 0}
				<div class="mt-4">
					<AdaptiveList
						data={conditionRows}
						columns={conditionColumns}>
						{#snippet cell(row, column)}
							{#if column.key === 'name'}
								<span class="font-medium">{row.name}</span>
							{:else if column.key === 'typeLabel'}
								{@render conditionType(row)}
							{:else if column.key === 'value'}
								{@render conditionValue(row)}
							{:else if column.key === 'radarr'}
								{@render conditionApps(row)}
							{:else if column.key === 'required'}
								{@render conditionFlags(row)}
							{/if}
						{/snippet}
						{#snippet card(row)}
							<div class="flex items-start justify-between gap-3">
								<p class="text-sm font-medium">{row.name}</p>
								{@render conditionType(row)}
							</div>
							<dl
								class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
								<dt class="text-text-muted">
									{row.regularExpressionHref ? 'Regular expression' : 'Value'}
								</dt>
								<dd class="min-w-0 break-words">{@render conditionValue(row)}</dd>
								<dt class="text-text-muted">Applies to</dt>
								<dd>{@render conditionApps(row)}</dd>
							</dl>
							<div class="mt-3">{@render conditionFlags(row)}</div>
						{/snippet}
					</AdaptiveList>
				</div>
			{:else}
				<p class="mt-4 text-sm text-text-muted italic">No conditions.</p>
			{/if}
		</section>

		{#if format.tests.length > 0}
			<section aria-labelledby="tests">
				<h2 id="tests">Tests</h2>
				{#each format.tests as test, index (index)}
					<article>
						<h3>{test.title}</h3>
						<dl>
							<dt>Type</dt>
							<dd>{test.type}</dd>
							<dt>Expected to Match</dt>
							<dd>{test.shouldMatch ? 'Yes' : 'No'}</dd>
						</dl>
						{#if test.description}
							<p>{test.description}</p>
						{/if}
					</article>
				{/each}
			</section>
		{/if}

		<section aria-labelledby="references">
			<h2
				id="references"
				class="mt-8 border-b border-border-muted pb-2 text-xl font-bold">
				References
			</h2>
			{#if references.length > 0}
				<div class="mt-4">
					<AdaptiveList
						data={references}
						columns={referenceColumns}
						href={(row) => `/pcd/${page.params.database}/quality-profiles/${row.slug}`}>
						{#snippet cell(row, column)}
							{#if column.key === 'name'}
								<span class="font-medium">{row.name}</span>
							{:else if column.key === 'scores'}
								{@render scoreList(row)}
							{/if}
						{/snippet}
						{#snippet card(row)}
							<p class="text-sm font-medium">{row.name}</p>
							<div class="mt-2">{@render scoreList(row)}</div>
						{/snippet}
					</AdaptiveList>
				</div>
			{:else}
				<p class="mt-4 text-sm text-text-muted italic">
					No quality profiles reference this custom format.
				</p>
			{/if}
		</section>
	{/snippet}
</EntityView>

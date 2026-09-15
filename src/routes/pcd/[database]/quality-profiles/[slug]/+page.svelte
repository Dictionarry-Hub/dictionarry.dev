<script lang="ts">
	import EntityHistory from '$lib/client/pcd/EntityHistory.svelte';
	import PageHeader from '$lib/client/ui/header/PageHeader.svelte';
	import SEO from '$lib/client/ui/utils/SEO.svelte';

	let { data } = $props();
	const profile = $derived(data.profile);
</script>

<SEO
	title={profile.name}
	description={profile.description ?? undefined} />

<PageHeader
	title={profile.name}
	tags={profile.tags} />

<!-- The rest of the profile page is not built yet; History ships first. -->
<h2
	id="history"
	class="mt-8 border-b border-border-muted pb-2 text-xl font-bold">
	History
</h2>
<EntityHistory history={data.history} />

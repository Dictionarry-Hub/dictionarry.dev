<script lang="ts">
	import { Icon, type IconProps } from '@lucide/svelte';
	import { astronautHelmet } from '@lucide/lab';

	let props: IconProps = $props();
</script>

<Icon
	iconNode={astronautHelmet}
	{...props} />

<script lang="ts">
	import { Icon, type IconProps } from '@lucide/svelte';
	import { ufo } from '@lucide/lab';

	let props: IconProps = $props();
</script>

<Icon
	iconNode={ufo}
	{...props} />

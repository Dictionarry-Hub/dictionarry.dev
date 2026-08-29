<script lang="ts">
	import { Icon, type IconProps } from '@lucide/svelte';
	import { floppyDisk2 } from '@lucide/lab';

	let props: IconProps = $props();
</script>

<Icon
	iconNode={floppyDisk2}
	{...props} />

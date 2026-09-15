<script lang="ts">
	interface Props {
		date: string;
		format?: 'short' | 'long' | 'numeric';
		class?: string;
	}

	let { date, format = 'long', class: className }: Props = $props();

	const parsed = $derived(new Date(date));

	const iso = $derived(date.split('T')[0]);

	const formatted = $derived.by(() => {
		// Numeric follows the visitor's locale (9/8/2026 or 08/09/2026). The
		// prerendered text uses the build machine's locale and is patched on
		// hydration; the datetime attribute is always ISO.
		if (format === 'numeric') {
			return parsed.toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'numeric',
				day: 'numeric'
			});
		}
		if (format === 'short') {
			return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		}
		return parsed.toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	});
</script>

<time
	datetime={iso}
	class={className}>
	{formatted}
</time>

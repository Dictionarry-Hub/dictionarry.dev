<script lang="ts">
	interface Props {
		date: string;
		format?: 'short' | 'long' | 'iso';
		class?: string;
	}

	let { date, format = 'long', class: className }: Props = $props();

	const parsed = $derived(new Date(date));

	const iso = $derived(date.split('T')[0]);

	const formatted = $derived.by(() => {
		if (format === 'iso') return iso;
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

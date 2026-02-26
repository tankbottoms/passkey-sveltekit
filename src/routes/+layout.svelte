<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initTheme, toggleTheme, isDarkMode } from '$lib/theme.svelte';

	let { children, data } = $props();

	onMount(() => {
		initTheme();
	});
</script>

<svelte:head>
	<title>PASSKEY//GATE</title>
	<meta name="description" content="Passkey authentication gate" />
</svelte:head>

<nav class="site-nav">
	<div class="nav-inner">
		<a href="/" class="nav-brand">PASSKEY//GATE</a>
		<div class="nav-right">
			{#if data.user}
				<a href="/logs" class="nav-link">LOGS</a>
				<span class="nav-user">{data.user.username}</span>
				<span class="badge badge-success">AUTHENTICATED</span>
			{:else}
				<span class="badge badge-warning">LOCKED</span>
			{/if}
			<button class="theme-toggle" onclick={toggleTheme} title="Toggle theme">
				{isDarkMode() ? 'LIGHT' : 'DARK'}
			</button>
		</div>
	</div>
</nav>

<main class="site-main">
	{@render children()}
</main>

<style>
	.site-nav {
		border-bottom: 2px solid var(--color-border-dark);
		background: var(--color-bg);
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.nav-inner {
		max-width: 640px;
		margin: 0 auto;
		padding: 0 var(--spacing-lg);
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 48px;
	}

	.nav-brand {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 0.9rem;
		letter-spacing: 0.1em;
		color: var(--color-text);
		text-decoration: none !important;
	}

	.nav-link {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
		text-decoration: none;
	}

	.nav-link:hover {
		color: var(--color-text);
		text-decoration: none;
	}

	.nav-right {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.nav-user {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}

	.theme-toggle {
		font-size: 0.65rem;
		padding: 0.25rem 0.5rem;
		box-shadow: 1px 1px 0px var(--color-shadow);
	}

	.site-main {
		padding: var(--spacing-xl) 0;
	}
</style>

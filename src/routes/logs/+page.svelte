<script lang="ts">
	interface LogEntry {
		id: string;
		site: string;
		level: 'debug' | 'info' | 'warn' | 'error';
		message: string;
		timestamp: string;
		path?: string;
		userAgent?: string;
		ip?: string;
		metadata?: Record<string, unknown>;
	}

	let entries = $state<LogEntry[]>([]);
	let sites = $state<string[]>([]);
	let selectedSite = $state('');
	let selectedDate = $state('');
	let loading = $state(false);
	let hasMore = $state(false);
	let cursor = $state<string | undefined>();
	let error = $state('');

	async function loadLogs(append = false) {
		loading = true;
		error = '';
		try {
			const params = new URLSearchParams();
			if (selectedSite) params.set('site', selectedSite);
			if (selectedDate) params.set('date', selectedDate);
			params.set('limit', '50');
			if (append && cursor) params.set('cursor', cursor);

			const resp = await fetch(`/api/logs?${params}`);
			if (!resp.ok) {
				const err = await resp.json();
				throw new Error(err.message || 'Failed to load logs');
			}

			const data = await resp.json();
			if (append) {
				entries = [...entries, ...data.entries];
			} else {
				entries = data.entries;
			}
			sites = data.sites;
			cursor = data.cursor;
			hasMore = data.hasMore;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load logs';
		} finally {
			loading = false;
		}
	}

	function handleFilter() {
		cursor = undefined;
		loadLogs();
	}

	function handleReset() {
		selectedSite = '';
		selectedDate = '';
		cursor = undefined;
		loadLogs();
	}

	function levelClass(level: string): string {
		switch (level) {
			case 'error': return 'log-error';
			case 'warn': return 'log-warn';
			case 'info': return 'log-info';
			case 'debug': return 'log-debug';
			default: return '';
		}
	}

	function formatTimestamp(ts: string): string {
		const d = new Date(ts);
		return d.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}

	$effect(() => {
		loadLogs();
	});
</script>

<div class="container logs-container">
	<div class="logs-header">
		<h2>LOGS</h2>
		<button onclick={() => loadLogs()} disabled={loading}>
			{loading ? 'LOADING...' : 'REFRESH'}
		</button>
	</div>

	<!-- Filters -->
	<div class="panel mt-md">
		<div class="panel-header">FILTERS</div>
		<div class="panel-body filter-row">
			<select bind:value={selectedSite} onchange={handleFilter}>
				<option value="">ALL SITES</option>
				{#each sites as site}
					<option value={site}>{site}</option>
				{/each}
			</select>
			<input
				type="date"
				bind:value={selectedDate}
				onchange={handleFilter}
			/>
			<button onclick={handleReset}>RESET</button>
		</div>
	</div>

	{#if error}
		<div class="status-bar error mt-sm">{error}</div>
	{/if}

	<!-- Log entries -->
	<div class="panel mt-md">
		<div class="panel-header">
			ENTRIES ({entries.length}{hasMore ? '+' : ''})
		</div>
		<div class="panel-body log-panel-body">
			{#if entries.length === 0 && !loading}
				<p class="text-muted text-sm">No log entries found.</p>
			{:else}
				<div class="log-entries">
					{#each entries as entry}
						<div class="log-entry {levelClass(entry.level)}">
							<div class="log-entry-header">
								<span class="badge badge-{entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warning' : 'info'}">
									{entry.level.toUpperCase()}
								</span>
								{#if entry.metadata?.source === 'client'}
									<span class="badge badge-client">CLIENT</span>
								{/if}
								<span class="log-site">{entry.site}</span>
								<span class="log-time">{formatTimestamp(entry.timestamp)}</span>
							</div>
							<div class="log-message">{entry.message}</div>
							{#if entry.path}
								<div class="log-meta">path: {entry.path}</div>
							{/if}
							{#if entry.metadata?.source === 'client' && entry.metadata?.device}
								{@const d = entry.metadata.device as {browser:string;os:string;deviceType:string;screenSize:string}}
								<div class="log-meta log-device">{d.browser} / {d.os} / {d.deviceType} / {d.screenSize}</div>
							{/if}
							{#if entry.metadata && Object.keys(entry.metadata).length > 0}
								<div class="log-meta">{JSON.stringify(entry.metadata)}</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if hasMore}
				<button class="mt-md" onclick={() => loadLogs(true)} disabled={loading}>
					LOAD MORE
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.logs-container {
		max-width: 800px;
	}

	.logs-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-md);
	}

	.logs-header h2 {
		letter-spacing: 0.1em;
	}

	.filter-row {
		display: flex;
		gap: var(--spacing-sm);
		flex-wrap: wrap;
		align-items: center;
	}

	select {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 0;
		background: var(--color-bg);
		color: var(--color-text);
		cursor: pointer;
	}

	select:focus {
		border-color: var(--color-border-dark);
		box-shadow: 2px 2px 0px var(--color-shadow);
		outline: none;
	}

	.log-panel-body {
		padding: 0;
	}

	.log-entries {
		max-height: 600px;
		overflow-y: auto;
	}

	.log-entry {
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
		font-size: 0.8rem;
	}

	.log-entry:last-child {
		border-bottom: none;
	}

	.log-entry:hover {
		background: var(--color-hover-bg);
	}

	.log-entry-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin-bottom: 0.25rem;
	}

	.log-site {
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-accent);
	}

	.log-time {
		font-size: 0.7rem;
		color: var(--color-text-muted);
		margin-left: auto;
	}

	.log-message {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		line-height: 1.4;
		word-break: break-word;
	}

	.log-meta {
		font-size: 0.7rem;
		color: var(--color-text-muted);
		margin-top: 0.15rem;
		word-break: break-all;
	}

	.log-entry.log-error {
		border-left: 3px solid var(--color-error);
	}

	.log-entry.log-warn {
		border-left: 3px solid var(--color-warning);
	}

	.log-entry.log-info {
		border-left: 3px solid var(--color-link);
	}

	.log-entry.log-debug {
		border-left: 3px solid var(--color-text-muted);
	}

	.badge-error {
		background: rgba(220, 53, 69, 0.15);
		border-color: var(--color-error);
		color: var(--color-error);
	}

	.badge-client {
		background: rgba(108, 99, 255, 0.15);
		border-color: #6c63ff;
		color: #6c63ff;
		font-size: 0.6rem;
	}

	.log-device {
		font-style: italic;
	}

	.status-bar {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid;
	}

	.status-bar.error {
		background: var(--color-error-bg);
		border-color: var(--color-error);
		color: var(--color-error);
	}

	@media (max-width: 480px) {
		.filter-row {
			flex-direction: column;
		}

		select, .filter-row input {
			width: 100%;
		}

		.log-entry-header {
			flex-wrap: wrap;
		}

		.log-time {
			margin-left: 0;
			width: 100%;
		}

		.logs-header button,
		.filter-row button,
		.log-panel-body > button {
			border: none;
			box-shadow: none;
			background: transparent;
			color: var(--color-text-muted);
			padding: 0.3rem 0.5rem;
			min-height: auto;
		}

		.logs-header button:hover,
		.filter-row button:hover,
		.log-panel-body > button:hover {
			color: var(--color-text);
			box-shadow: none;
			transform: none;
		}

		.logs-header button:active,
		.filter-row button:active,
		.log-panel-body > button:active {
			box-shadow: none;
			transform: none;
		}
	}
</style>

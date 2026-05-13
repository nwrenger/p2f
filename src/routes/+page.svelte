<script lang="ts">
	import { onMount } from 'svelte';
	import { ExternalLink, FileIcon } from 'lucide-svelte';
	import { FileUpload, Progress } from '@skeletonlabs/skeleton-svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import GitHub from '$lib/components/icons/GitHub.svelte';
	import { PeerSession } from '$lib/p2f/peerSession.svelte';
	import { toaster } from './+layout.svelte';

	const session = $state(new PeerSession(toaster));
	const transfers = $state(session.transfers);

	onMount(() => {
		session.initializeFromLocation();
	});
</script>

<svelte:head>
	<title>Peer to File | p2f</title>
	<meta
		name="description"
		content="Share files directly between two browsers with an encrypted WebRTC connection. no account, no upload step, and no server-side file storage."
	/>
	<!-- Open Graph -->
	<meta property="og:title" content="Peer to File | p2f" />
	<meta
		property="og:description"
		content="Share files directly between two browsers with an encrypted WebRTC connection. no account, no upload step, and no server-side file storage."
	/>
	<link rel="canonical" href="https://p2f.nwrenger.dev/" />
</svelte:head>

<div class="flex min-h-dvh flex-col items-center justify-center sm:p-8">
	<div class="mb-10 text-xs tracking-[0.3em] text-surface-700-300 uppercase">peer to file</div>

	<div
		class="w-full overflow-hidden card rounded-none preset-outlined-surface-200-800 preset-filled-surface-100-900 sm:max-w-2xl sm:rounded-container"
	>
		<div
			class="flex items-center justify-between gap-3 border-b border-surface-200-800 px-5 py-3.5"
		>
			<div class="flex min-w-0 items-center gap-2">
				<div class="hidden size-2 rounded-full preset-filled-error-500 sm:block"></div>
				<div class="hidden size-2 rounded-full preset-filled-warning-500 sm:block"></div>
				<div class="hidden size-2 rounded-full preset-filled-success-500 sm:block"></div>
				<span class="ml-1 truncate text-xs tracking-[0.15em] text-surface-700-300 uppercase">
					{#if session.role === 'host-gen'}host{/if}
					{#if session.role === 'host-wait'}waiting…{/if}
					{#if session.role === 'joiner'}joining…{/if}
					{#if session.role === 'connected'}connected{/if}
					{#if session.role === 'disconnected'}disconnected{/if}
					{#if session.role === 'detecting'}…{/if}
				</span>
			</div>
			<a
				href="https://github.com/nwrenger/p2f"
				target="_blank"
				class="flex shrink-0 items-center gap-2 anchor"
			>
				<GitHub size={16} />
				<span>Star on GitHub</span>
				<ExternalLink size={14} class="opacity-60" />
			</a>
		</div>

		<div class="px-5 py-6">
			<!-- host: initial -->
			{#if session.role === 'host-gen'}
				<div class="flex flex-col gap-4">
					<div class="flex flex-col gap-3">
						<p class="leading-6">
							share files directly between two browsers with an encrypted <code class="code"
								>WebRTC</code
							> connection. no account, no upload step, and no server-side file storage.
						</p>
						<p class="leading-6">
							to get started, generate an offer link and share it with your peer. once they join,
							you can both send files to each other.
						</p>
					</div>
					<button class="btn w-fit preset-filled-primary-500" onclick={session.generateOffer}
						>generate link</button
					>
				</div>
				<!-- host: waiting for joiner -->
			{:else if session.role === 'host-wait'}
				<div class="flex flex-col gap-4">
					<label class="label">
						<span class="label-text">share this link</span>
						<div class="input-group grid-cols-[1fr_auto]">
							<input
								class="ig-input"
								type="text"
								readonly
								value={session.offerLink}
								placeholder="gathering ice…"
							/>
							<CopyButton
								text={session.offerLink}
								class="ig-btn preset-filled"
								disabled={!session.linkReady}
							>
								{#snippet child({ copied })}
									{#if copied}copied{:else}copy{/if}
								{/snippet}
							</CopyButton>
						</div>
					</label>

					<hr class="hr" />

					<label class="label">
						<span class="label-text">paste answer</span>
						<textarea
							class="textarea resize-y"
							rows="2"
							bind:value={session.answerInput}
							placeholder="paste answer here…"
						></textarea>
					</label>

					<button
						class="btn w-fit preset-filled-primary-500"
						onclick={session.applyAnswer}
						disabled={!session.answerInput.trim()}>apply answer</button
					>

					<div class="flex items-center gap-1.5 text-xs">
						{session.hostStatus}
					</div>
				</div>

				<!-- joiner -->
			{:else if session.role === 'joiner'}
				<div class="flex flex-col gap-4">
					<label class="label">
						<span class="label-text">copy and send to host</span>
						<div class="input-group grid-cols-[1fr_auto]">
							<input
								class="ig-input"
								type="text"
								readonly
								value={session.answerSignal}
								placeholder="generating answer…"
							/>
							<CopyButton
								text={session.answerSignal}
								class="ig-btn preset-filled"
								disabled={!session.answerSignal}
							>
								{#snippet child({ copied })}
									{#if copied}copied{:else}copy{/if}
								{/snippet}
							</CopyButton>
						</div>
					</label>

					<div class="flex items-center gap-1.5 text-xs">
						{session.joinerStatus}
					</div>
				</div>

				<!-- connected -->
			{:else if session.role === 'connected'}
				<div class="flex flex-col gap-4">
					<FileUpload
						disabled={transfers.sending}
						maxFiles={5}
						acceptedFiles={transfers.files}
						onFileChange={(e) => (transfers.files = e.acceptedFiles)}
					>
						<FileUpload.Label>upload your files</FileUpload.Label>
						<FileUpload.Dropzone>
							<FileIcon class="size-10" />
							<span>select file or drag here.</span>
							<FileUpload.Trigger>browse files</FileUpload.Trigger>
							<FileUpload.HiddenInput />
						</FileUpload.Dropzone>
						<FileUpload.ItemGroup>
							<FileUpload.Context>
								{#snippet children()}
									{#each transfers.files as file (file.name)}
										<FileUpload.Item {file}>
											<FileUpload.ItemName class="text-surface-950-50"
												>{file.name}</FileUpload.ItemName
											>
											<FileUpload.ItemSizeText class="text-surface-950-50"
												>{file.size} bytes</FileUpload.ItemSizeText
											>
											<FileUpload.ItemDeleteTrigger class="text-surface-950-50" />
										</FileUpload.Item>
									{/each}
								{/snippet}
							</FileUpload.Context>
						</FileUpload.ItemGroup>
						<FileUpload.ClearTrigger class="not-[hover]:text-surface-950-50"
							>clear files</FileUpload.ClearTrigger
						>
					</FileUpload>

					<div class="flex items-center gap-2">
						<button
							class="btn w-fit preset-filled"
							disabled={transfers.sending || transfers.files.length === 0}
							onclick={() => transfers.sendFiles()}
						>
							{transfers.sending ? 'sending…' : 'send'}
						</button>
						<button
							class="btn w-fit preset-filled-error-500"
							disabled={!transfers.sending}
							onclick={() => transfers.cancelSend()}
						>
							cancel
						</button>
					</div>

					{#if transfers.sending || (transfers.sendProgress > 0 && transfers.sendProgress < 100)}
						<Progress value={transfers.sendProgress} max={100} class="flex flex-col gap-1">
							<div class="flex items-center justify-between text-xs text-surface-700-300">
								<Progress.Label>sending '{transfers.sendProgressLabel}'</Progress.Label>
								<div class="flex items-center gap-2">
									<Progress.ValueText />
								</div>
							</div>
							<Progress.Track class="h-2 overflow-hidden rounded-container preset-tonal">
								<Progress.Range class="h-full rounded-container preset-filled-primary-500" />
							</Progress.Track>
						</Progress>
					{/if}

					{#each transfers.downloadedTransfers as [id, transfer] (id)}
						<div
							class="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 card rounded-base preset-tonal-secondary p-3 text-sm leading-6"
						>
							<button
								class="btn-icon px-2 py-1"
								onclick={() => transfers.removeDownloadedTransfer(id)}>×</button
							>
							<div class="flex min-w-0 items-center gap-4 overflow-hidden">
								<span class="min-w-0 truncate">{transfer.name}</span>
								<span class="shrink-0 text-sm opacity-70">{transfer.size} bytes</span>
							</div>
							<button
								class="btn w-fit preset-filled-secondary-500 btn-sm uppercase"
								onclick={() => transfers.downloadTransfer(id, transfer)}>open</button
							>
						</div>
					{/each}

					{#if transfers.downloading}
						<Progress value={transfers.receiveProgress} max={100} class="flex flex-col gap-1">
							<div class="flex items-center justify-between text-xs text-surface-700-300">
								<Progress.Label>receiving '{transfers.receiveProgressLabel}'</Progress.Label>
								<div class="flex items-center gap-2">
									<Progress.ValueText />
								</div>
							</div>
							<Progress.Track class="h-2 overflow-hidden rounded-container preset-tonal">
								<Progress.Range class="h-full rounded-container preset-filled-success-500" />
							</Progress.Track>
						</Progress>
					{/if}
				</div>
			{:else if session.role === 'disconnected'}
				<div class="flex flex-col gap-4">
					<div class="card rounded-base preset-tonal-error p-4">
						<p class="leading-6">the peer connection closed...</p>
					</div>
					<button class="btn w-fit preset-filled-primary-500" onclick={session.reset}
						>start over</button
					>
				</div>
			{:else}
				<div class="flex flex-col gap-4">
					<p class="text-sm leading-6">detecting environment…</p>
				</div>
			{/if}
		</div>
	</div>
</div>

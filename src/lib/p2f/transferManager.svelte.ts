import Peer from 'tiny-simple-peer';
import { createChunkFrame, createTransferId, parsePeerData } from './transferFrames';
import type { IncomingTransfer, ToastDispatcher, TransferMessage } from './types';

const CHUNK_SIZE = 128 * 1024;
const MAX_BUFFERED_AMOUNT = 8 * 1024 * 1024;

export class TransferManager {
	files = $state<File[]>([]);
	downloading = $state(false);
	sending = $state(false);
	sendProgress = $state(0);
	receiveProgress = $state(0);
	sendProgressLabel = $state('');
	receiveProgressLabel = $state('');
	activeSendId = $state('');
	activeReceiveId = $state('');
	downloadedTransfers = $state([] as Array<[string, IncomingTransfer]>);

	private incomingTransfers = new Map<string, IncomingTransfer>();
	private outgoingTransfers = new Map<string, string>();
	private cancelledTransfers = new Set<string>();
	private locallyCancelledTransfers = new Set<string>();

	constructor(
		private readonly getPeer: () => Peer | null,
		private readonly toaster: ToastDispatcher
	) {}

	handleData(data: string | ArrayBuffer | Uint8Array) {
		try {
			const parsed = parsePeerData(data);

			if (parsed.kind === 'message') {
				this.handleTransferMessage(parsed.message);
			} else if (parsed.kind === 'chunk') {
				this.handleChunk(parsed.header, parsed.chunk);
			}
		} catch (error) {
			this.toaster.error({
				title: 'Transfer error',
				description: error instanceof Error ? error.message : 'received invalid transfer data'
			});
		}
	}

	removeDownloadedTransfer(id: string) {
		this.downloadedTransfers.splice(
			this.downloadedTransfers.findIndex(([transferId]) => transferId === id),
			1
		);
	}

	downloadTransfer(id: string, transfer: IncomingTransfer) {
		const chunks = transfer.chunks.filter((chunk): chunk is ArrayBuffer => Boolean(chunk));
		const blob = new Blob(chunks, { type: transfer.mime || 'application/octet-stream' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = transfer.name;
		anchor.target = '_blank';
		anchor.click();
		URL.revokeObjectURL(url);

		this.removeDownloadedTransfer(id);
		this.incomingTransfers.delete(id);
	}

	async sendFiles() {
		const peer = this.getPeer();
		if (this.files.length === 0 || !peer || this.sending) return;

		this.sending = true;
		this.sendProgress = 0;
		try {
			for (const file of this.files) {
				await this.sendFile(file);
				if (!this.sending) break;
			}
			if (this.sending) this.sendProgress = 100;
		} finally {
			this.sending = false;
			this.activeSendId = '';
		}
	}

	cancelSend() {
		if (!this.activeSendId) return;

		const name = this.outgoingTransfers.get(this.activeSendId) ?? this.sendProgressLabel;
		this.cancelledTransfers.add(this.activeSendId);
		this.locallyCancelledTransfers.add(this.activeSendId);
		this.sendJson({ type: 'file-cancel', id: this.activeSendId });
		this.sending = false;
		this.sendProgress = 0;

		this.toaster.error({
			title: 'Transfer cancelled',
			description: `${name} was cancelled`
		});
	}

	cancelActiveTransfers() {
		if (this.activeSendId) {
			this.cancelledTransfers.add(this.activeSendId);
			this.activeSendId = '';
		}

		if (this.activeReceiveId) {
			this.cancelledTransfers.add(this.activeReceiveId);
			this.incomingTransfers.delete(this.activeReceiveId);
			this.activeReceiveId = '';
		}

		this.sending = false;
		this.downloading = false;
	}

	reset() {
		this.files = [];
		this.downloading = false;
		this.sending = false;
		this.sendProgress = 0;
		this.receiveProgress = 0;
		this.sendProgressLabel = '';
		this.receiveProgressLabel = '';
		this.activeSendId = '';
		this.activeReceiveId = '';
		this.incomingTransfers.clear();
		this.outgoingTransfers.clear();
		this.cancelledTransfers.clear();
		this.locallyCancelledTransfers.clear();
		this.downloadedTransfers.splice(0);
	}

	private handleTransferMessage(message: TransferMessage) {
		if (message.type === 'file-complete') {
			const name = this.outgoingTransfers.get(message.id) ?? message.name;
			this.outgoingTransfers.delete(message.id);
			if (message.id === this.activeSendId) this.activeSendId = '';

			this.toaster.success({
				title: 'Transfer completed',
				description: `${name} was received successfully`
			});

			return;
		}

		if (message.type === 'file-cancelled') {
			if (this.locallyCancelledTransfers.has(message.id)) {
				this.locallyCancelledTransfers.delete(message.id);
				this.outgoingTransfers.delete(message.id);
				return;
			}

			const name = this.outgoingTransfers.get(message.id) ?? message.name ?? 'file';
			this.outgoingTransfers.delete(message.id);

			if (message.id === this.activeSendId) {
				this.sending = false;
				this.activeSendId = '';
				this.sendProgressLabel = 'cancelled';
			}

			this.toaster.error({
				title: 'Transfer cancelled',
				description: message.reason ? `${name}: ${message.reason}` : `${name} was cancelled`
			});

			return;
		}

		if (message.type === 'file-error') {
			const name = this.outgoingTransfers.get(message.id) ?? message.name ?? 'file';
			this.outgoingTransfers.delete(message.id);

			if (message.id === this.activeSendId) {
				this.sending = false;
				this.activeSendId = '';
			}

			this.toaster.error({
				title: 'Transfer failed',
				description: `${name}: ${message.error}`
			});

			return;
		}

		if (message.type === 'file-cancel') {
			this.cancelledTransfers.add(message.id);
			const transfer = this.incomingTransfers.get(message.id);

			if (message.id === this.activeSendId) {
				this.sending = false;
				this.sendProgressLabel = 'cancelled';
			}

			if (transfer) {
				this.incomingTransfers.delete(message.id);
				this.downloading = this.incomingTransfers.size > 0;
				this.receiveProgressLabel = 'cancelled';
				if (message.id === this.activeReceiveId) this.activeReceiveId = '';
				this.sendJson({
					type: 'file-cancelled',
					id: message.id,
					name: transfer?.name,
					reason: 'sender cancelled'
				});
			}

			this.toaster.error({
				title: 'Transfer cancelled',
				description: transfer
					? `${transfer.name} was cancelled by the sender`
					: 'the sender cancelled the transfer'
			});

			return;
		}

		if (message.type !== 'file-meta' || this.cancelledTransfers.has(message.id)) return;

		this.incomingTransfers.set(message.id, {
			name: message.name,
			size: message.size,
			mime: message.mime,
			totalChunks: message.totalChunks,
			receivedChunks: 0,
			receivedBytes: 0,
			chunks: new Array(message.totalChunks)
		});

		this.downloading = true;
		this.receiveProgress = 0;
		this.receiveProgressLabel = message.name;
		this.activeReceiveId = message.id;
	}

	private handleChunk(
		header: Extract<TransferMessage, { type: 'file-chunk' }>,
		chunk: ArrayBuffer
	) {
		if (this.cancelledTransfers.has(header.id)) return;

		const transfer = this.incomingTransfers.get(header.id);
		if (!transfer) {
			this.sendJson({
				type: 'file-error',
				id: header.id,
				error: 'received chunk for unknown transfer'
			});
			return;
		}
		if (transfer.chunks[header.chunkIndex]) return;

		transfer.chunks[header.chunkIndex] = chunk;
		transfer.receivedChunks += 1;
		transfer.receivedBytes += chunk.byteLength;
		this.receiveProgress =
			transfer.size === 0
				? 100
				: Math.min(100, Math.round((transfer.receivedBytes / transfer.size) * 100));
		this.receiveProgressLabel = transfer.name;

		if (transfer.receivedChunks === transfer.totalChunks) {
			this.downloadedTransfers.push([header.id, transfer]);
			this.incomingTransfers.delete(header.id);
			this.downloading = false;
			this.activeReceiveId = '';
			this.sendJson({
				type: 'file-complete',
				id: header.id,
				name: transfer.name
			});
		}
	}

	private async sendFile(file: File) {
		const peer = this.getPeer();
		if (!peer) return;

		const id = createTransferId();
		const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
		let sentBytes = 0;

		this.sendProgress = 0;
		this.sendProgressLabel = file.name;
		this.activeSendId = id;
		this.outgoingTransfers.set(id, file.name);
		this.cancelledTransfers.delete(id);
		this.sendJson({
			type: 'file-meta',
			id,
			name: file.name,
			size: file.size,
			mime: file.type,
			totalChunks
		});

		for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
			if (this.cancelledTransfers.has(id) || !this.sending) return;

			const offset = chunkIndex * CHUNK_SIZE;
			const payload = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();

			await this.waitForBufferedAmount(id);
			if (this.cancelledTransfers.has(id) || !this.sending) return;

			peer.send(createChunkFrame({ type: 'file-chunk', id, chunkIndex }, payload));
			sentBytes += payload.byteLength;
			this.sendProgress =
				file.size === 0 ? 100 : Math.min(100, Math.round((sentBytes / file.size) * 100));
		}
	}

	private sendJson(message: TransferMessage) {
		this.getPeer()?.send(JSON.stringify(message));
	}

	private async waitForBufferedAmount(id: string) {
		while (
			this.getBufferedAmount() > MAX_BUFFERED_AMOUNT &&
			!this.cancelledTransfers.has(id) &&
			this.sending
		) {
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
	}

	private getBufferedAmount() {
		const dataChannel = (this.getPeer() as (Peer & { _channel?: RTCDataChannel }) | null)?._channel;
		return dataChannel?.bufferedAmount ?? 0;
	}
}

import type { TransferMessage } from './types';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function parsePeerData(data: string | ArrayBuffer | Uint8Array) {
	if (typeof data === 'string') {
		return { kind: 'message' as const, message: JSON.parse(data) as TransferMessage };
	}

	const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

	if (bytes[0] === 123) {
		return {
			kind: 'message' as const,
			message: JSON.parse(textDecoder.decode(bytes)) as TransferMessage
		};
	}

	return parseChunkFrame(bytes);
}

export function createChunkFrame(header: TransferMessage, payload: ArrayBuffer) {
	const headerBytes = textEncoder.encode(JSON.stringify(header));
	const frame = new Uint8Array(4 + headerBytes.byteLength + payload.byteLength);

	new DataView(frame.buffer).setUint32(0, headerBytes.byteLength);
	frame.set(headerBytes, 4);
	frame.set(new Uint8Array(payload), 4 + headerBytes.byteLength);

	return frame.buffer;
}

function parseChunkFrame(frame: Uint8Array) {
	let header: TransferMessage;
	let payloadStart: number;

	try {
		const headerLength = new DataView(frame.buffer, frame.byteOffset, 4).getUint32(0);
		const headerStart = 4;
		payloadStart = headerStart + headerLength;
		header = JSON.parse(
			textDecoder.decode(frame.slice(headerStart, payloadStart))
		) as TransferMessage;
	} catch {
		throw new Error('invalid chunk frame');
	}

	if (header.type !== 'file-chunk') {
		return { kind: 'ignored' as const };
	}

	const payload = frame.slice(payloadStart);
	const chunk = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);

	return { kind: 'chunk' as const, header, chunk };
}

export function createTransferId() {
	return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

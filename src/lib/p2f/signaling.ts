export async function encodeSignal(signal: unknown) {
	const json = JSON.stringify(signal);
	const compressed = await compressText(json);
	return base64UrlEncode(compressed);
}

export async function decodeSignal(encoded: string) {
	const compressed = base64UrlDecode(encoded);
	return JSON.parse(await decompressText(compressed));
}

async function compressText(value: string) {
	const stream = new Blob([value]).stream().pipeThrough(new CompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompressText(value: Uint8Array) {
	const buffer = new ArrayBuffer(value.byteLength);
	new Uint8Array(buffer).set(value);
	const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
	return await new Response(stream).text();
}

function base64UrlEncode(value: Uint8Array) {
	let binary = '';
	for (const byte of value) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecode(value: string) {
	const base64 = value
		.replaceAll('-', '+')
		.replaceAll('_', '/')
		.padEnd(Math.ceil(value.length / 4) * 4, '=');
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

declare module 'tiny-simple-peer' {
	import { EventEmitter } from 'events';

	interface Options {
		initiator?: boolean;
		trickle?: boolean;
		config?: RTCConfiguration;
		channelConfig?: RTCDataChannelInit;
		channelName?: string;
		sdpTransform?: (sdp: string) => string;
	}

	class Peer extends EventEmitter {
		constructor(opts?: Options);
		signal(data: unknown): void;
		send(data: string | ArrayBufferView | ArrayBuffer): void;
		destroy(err?: Error): void;
		readonly connected: boolean;
	}

	export default Peer;
}

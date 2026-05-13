import { goto } from '$app/navigation';
import Peer from 'tiny-simple-peer';
import { decodeSignal, encodeSignal } from './signaling';
import { TransferManager } from './transferManager.svelte';
import type { Role, ToastDispatcher } from './types';

const iceServers: RTCIceServer[] = [
	{
		urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478']
	},
	{
		urls: ['turn:freestun.net:3478', 'turns:freestun.net:5349'],
		username: 'free',
		credential: 'free'
	}
];

export const rtcConfig: RTCConfiguration = {
	iceServers,
	iceTransportPolicy: 'all'
};

export class PeerSession {
	role = $state<Role>('detecting');
	peer = $state<Peer | null>(null);
	offerLink = $state('');
	linkReady = $state(false);
	answerInput = $state('');
	hostStatus = $state('');
	answerSignal = $state('');
	joinerStatus = $state('');
	transfers: TransferManager;

	constructor(toaster: ToastDispatcher) {
		this.transfers = new TransferManager(() => this.peer, toaster);
	}

	initializeFromLocation() {
		const params = new URLSearchParams(window.location.search);
		const offerParam = params.get('offer');
		if (offerParam) {
			this.role = 'joiner';
			this.joinFromOffer(offerParam);
		} else {
			this.role = 'host-gen';
		}

		goto(window.location.pathname, { replaceState: true });
	}

	generateOffer = () => {
		this.role = 'host-wait';
		this.hostStatus = 'gathering ICE candidates…';

		this.peer = new Peer({ initiator: true, trickle: false, config: rtcConfig });
		this.setupPeerEvents(this.peer);

		this.peer.on('signal', async (data) => {
			const encoded = await encodeSignal(data);
			const url = window.location.origin + window.location.pathname + '?offer=' + encoded;
			this.offerLink = url;
			this.linkReady = true;
			this.hostStatus = 'waiting for you to proceed...';
		});

		this.peer.on('error', (err) => {
			this.hostStatus = 'error: ' + err.message;
		});
	};

	applyAnswer = async () => {
		if (!this.answerInput.trim()) return;
		try {
			const data = await decodeSignal(this.answerInput.trim());
			this.peer?.signal(data);
			this.hostStatus = 'signaling… connecting to peer';
		} catch {
			this.hostStatus = 'invalid answer — make sure you pasted the full string';
		}
	};

	reset = () => {
		this.peer = null;
		this.offerLink = '';
		this.linkReady = false;
		this.answerInput = '';
		this.hostStatus = '';
		this.answerSignal = '';
		this.joinerStatus = '';
		this.transfers.reset();
		this.role = 'host-gen';
	};

	private async joinFromOffer(encoded: string) {
		let offerSignal;
		try {
			offerSignal = await decodeSignal(encoded);
		} catch {
			this.joinerStatus = 'error: bad offer in URL';
			return;
		}

		this.peer = new Peer({ initiator: false, trickle: false });
		this.setupPeerEvents(this.peer);

		this.peer.on('signal', async (data) => {
			this.answerSignal = await encodeSignal(data);
			this.joinerStatus = 'waiting for you to proceed...';
		});

		this.peer.on('error', (err) => {
			this.joinerStatus = 'error: ' + err.message;
		});

		this.peer.signal(offerSignal);
	}

	private setupPeerEvents(activePeer: Peer) {
		activePeer.on('connect', this.onConnected);
		activePeer.on('data', this.transfers.handleData.bind(this.transfers));
		activePeer.on('close', this.onDisconnected);
		activePeer.on('error', this.onPeerError);
	}

	private onConnected = () => {
		this.role = 'connected';
	};

	private onPeerError = (error: Error) => {
		console.error('Peer error:', error);
	};

	private onDisconnected = () => {
		this.transfers.cancelActiveTransfers();
		this.role = 'disconnected';
	};
}

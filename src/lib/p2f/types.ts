export type Role = 'detecting' | 'host-gen' | 'host-wait' | 'joiner' | 'connected' | 'disconnected';

export type TransferMessage =
	| {
			type: 'file-meta';
			id: string;
			name: string;
			size: number;
			mime: string;
			totalChunks: number;
	  }
	| {
			type: 'file-chunk';
			id: string;
			chunkIndex: number;
	  }
	| {
			type: 'file-cancel';
			id: string;
	  }
	| {
			type: 'file-complete';
			id: string;
			name: string;
	  }
	| {
			type: 'file-cancelled';
			id: string;
			name?: string;
			reason?: string;
	  }
	| {
			type: 'file-error';
			id: string;
			name?: string;
			error: string;
	  };

export type IncomingTransfer = {
	name: string;
	size: number;
	mime: string;
	totalChunks: number;
	receivedChunks: number;
	receivedBytes: number;
	chunks: Array<ArrayBuffer | undefined>;
};

export type ToastDispatcher = {
	success(message: { title: string; description: string }): void;
	error(message: { title: string; description: string }): void;
};

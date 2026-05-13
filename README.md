# p2f

_Peer to File_

Encrypted peer-to-peer file transfer in the browser.

`p2f` lets two browsers exchange files directly over a WebRTC data channel. The app only uses the URL/manual answer exchange for signaling; file data is not uploaded to an application server.

## Features

- Direct browser-to-browser file transfer with WebRTC.
- No account, upload step, or server-side file storage.
- Compressed invite links using `CompressionStream('deflate-raw')`.
- Chunked transfer for larger files.
- Send and receive progress indicators.
- Transfer cancellation.
- Disconnect detection with a reset flow.

## How It Works

1. The host generates an offer link.
2. The second browser opens the link and creates an answer.
3. The answer is copied back to the host.
4. Once connected, either side can send selected files.
5. Files are split into chunks, sent through the WebRTC data channel, and rebuilt locally as downloadable files.

The offer and answer contain WebRTC signaling data only. The selected files move over the peer connection after both sides connect.

## Limitations

- Both browsers need to stay open until transfers finish.
- Very large files depend on browser memory, network quality, and WebRTC data-channel throughput.
- If direct peer connectivity fails, transfer may require TURN infrastructure.
- Links are shorter than raw SDP links due to compression, but still not as short as server-backed pairing codes.

## Contributing & Issues

I warmly welcome:

- Bug reports
- Feature requests
- Pull requests

Please open issues or PRs on [GitHub](https://github.com/nwrenger/p2f/issues).

## License

This project is licensed under the **GPLv3 License**. See [LICENSE](https://github.com/nwrenger/p2f/blob/main/LICENSE) for details.

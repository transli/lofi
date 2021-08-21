 module.exports = {
  httpIp: "0.0.0.0",
  listenIp: "0.0.0.0",
  httpPort: 3000,
  httpPeerStale: 360000,

  mediasoup: {
    worker: {
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
      logLevel: "debug",
      logTags: [
        "info",
        "ice",
        "dtls",
        "rtp",
        "srtp",
        "rtcp",
      ],
    },
    router: {
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
      ],
    },
	// listening Host or IP 
	// If omitted listens on every IP. ("0.0.0.0" and "::")
	// listeningHost: 'localhost',
	// Listening port for https server.
	listeningPort         : 443,
	// Any http request is redirected to https.
	// Listening port for http server.
	listeningRedirectPort : 80,
	// Listens only on http, only on listeningPort
	// listeningRedirectPort disabled
	// use case: loadbalancer backend
	httpOnly              : false,
	// WebServer/Express trust proxy config for httpOnly mode
	// You can find more info:
	//  - https://expressjs.com/en/guide/behind-proxies.html
	//  - https://www.npmjs.com/package/proxy-addr
	// use case: loadbalancer backend
	trustProxy            : '',
    // rtp listenIps are the most important thing, below. you'll need
    // to set these appropriately for your network for the demo to
    // run anywhere but on localhost 192.168.43.52
    webRtcTransport: {
      listenIps: [
        {
          ip: process.env.WEBRTC_LISTEN_IP || "127.0.0.1",
          announcedIp: process.env.A_IP || "127.0.0.1",
        },
        // { ip: "192.168.42.68", announcedIp: null },
        // { ip: '10.10.23.101', announcedIp: null },
      ],
      initialAvailableOutgoingBitrate: 800000,
    },
  },
}

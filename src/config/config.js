const os = require('os')
const local = true;
const hasMediasoup = true;
const announcedIp = process.env.A_IP || (local ? localIp() : null);
 
 module.exports = {
  httpIp: "0.0.0.0",
  listenIp: "0.0.0.0",
  httpPort: 3000,
  httpPeerStale: 360000,

  mediasoup: {
    numWorkers: Object.keys(os.cpus()).length,
    // worker: {
    //   rtcMinPort: 40000,
    //   rtcMaxPort: 49999,
    //   logLevel: "debug",
    //   logTags: [
    //     "info",
    //     "ice",
    //     "dtls",
    //     "rtp",
    //     "srtp",
    //     "rtcp",
    //   ],
    // },
    workerSettings: {
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtx', 'score', 'svc'],
      rtcMinPort: Number(process.env.MEDIASOUP_MIN_PORT || 30000),
      rtcMaxPort: Number(process.env.MEDIASOUP_MAX_PORT || 39999),
    },
    // mediasoup Router options.
    // See https://mediasoup.org/documentation/v3/mediasoup/api/#RouterOptions
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
    // run anywhere but on localhost 192.168.43.52 127.0.0.1
    webRtcTransport: {
      enableUdp: false,
      enableTcp: true,
      listenIps: [
        {
          ip: process.env.WEBRTC_LISTEN_IP || "0.0.0.0",
          announcedIp,
        },
        // { ip: "192.168.42.68", announcedIp: null },
        // { ip: '10.10.23.101', announcedIp: null },
      ],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      maxSctpMessageSize: 262144,
    },
  },
}

function localIp() {
  let interfaces = [].concat(...Object.values(os.networkInterfaces()));
  let ip = interfaces.find(x => !x.internal && x.family === 'IPv4')?.address;
  if (hasMediasoup) console.log('mediasoup: falling back to announced IP', ip);
  return ip;
}

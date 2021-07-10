const debugModule = require('debug');
const config = require("../../config/config");

const log = debugModule("wine:create-transport");

// WebRtcTransport
const transportToOptions = ({
  id,
  iceParameters,
  iceCandidates,
  dtlsParameters,
}) => ({ id, iceParameters, iceCandidates, dtlsParameters });


const createTransport = async (
  direction,
  router,
  peer_id
) => {
  log("create-transport", direction);
  const {
    listenIps,
    initialAvailableOutgoingBitrate,
  } = config.mediasoup.webRtcTransport;

  const transport = await router.createWebRtcTransport({
    listenIps: listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: initialAvailableOutgoingBitrate,
    appData: { peer_id, clientDirection: direction },
  });
  return transport;
};

module.exports = {
  transportToOptions,
  createTransport,
};

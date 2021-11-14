const mediasoup = require('mediasoup');
const config = require('../config/config');

module.exports = async function () {
  const workers = [];
  for (let i = 0; i < config.mediasoup.numWorkers; i++) {
    let worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.workerSettings.logLevel,
      logTags: config.mediasoup.workerSettings.logTags,
      rtcMinPort: config.mediasoup.workerSettings.rtcMinPort,
      rtcMaxPort: config.mediasoup.workerSettings.rtcMaxPort,
    });

    worker.on("died", () => {
      console.error("mediasoup worker died (this should never happen)");
      process.exit(1);
    });

    const mediaCodecs = config.mediasoup.router.mediaCodecs;
    const router = await worker.createRouter({ mediaCodecs });

    workers.push({ worker, router });
  }

  return workers;
}

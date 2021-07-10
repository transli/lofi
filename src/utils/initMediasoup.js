const mediasoup = require('mediasoup');
const os = require('os');
const config = require('../config/config');

module.exports = async function () {
  const workers = [];
  for (let i = 0; i < Object.keys(os.cpus()).length; i++) {
    let worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
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

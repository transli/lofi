const createConsumer = async (
  router,
  producer,
  rtpCapabilities,
  transport,
  peer_id,
  peerConsuming
) => {
  if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
    throw new Error(
      `recv-track: client cannot consume ${producer.appData.peer_id}`
    );
  }

  const consumer = await transport.consume({
    producerId: producer.id,
    rtpCapabilities,
    paused: false, // see note above about always starting paused
    appData: { peer_id, mediaPeerId: producer.appData.peer_id },
  });

  peerConsuming.consumers.push(consumer);

  return {
    peer_id: producer.appData.peer_id,
    consumerParameters: {
      producerId: producer.id,
      id: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      producerPaused: consumer.producerPaused,
    },
  };
};

module.exports = createConsumer;

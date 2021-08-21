require("dotenv/config");
const Sentry = require("@sentry/node");
const debugModule = require('debug');
const  initMediasoup  = require("./utils/initMediasoup");
const initRabbitMq = require("./utils/initRabbitMq");
const {createTransport, transportToOptions} = require('./utils/helpers/createTransport');
const createConsumer = require('./utils/helpers/createConsumer');
const closePeer = require('./utils/helpers/closePeer');

// rooms container
const rooms = {};

const log = debugModule("lofi:index");


(async function() {
  if(process.env.SENTRY_DSN){
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
    
      enabled: !!process.env.SENTRY_DSN,
    
      // Set tracesSampleRate to 1.0 to capture 100%
      // of transactions for performance monitoring.
      // We recommend adjusting this value in production
      tracesSampleRate: 1.0,
    });
  }
  log("starting mediasoup");
  let workers;
  try {
    workers = await initMediasoup();
  } catch (err) {
    log(err);
    throw err;
  }

  let workerIdx = 0;

  const getNextWorker = () => {
    const w = workers[workerIdx];
    workerIdx++;
    workerIdx %= workers.length;
    return w;
  };

  const createRoom = () => {
    const { worker, router } = getNextWorker();
    return { worker, router, state: {} };
  };

  await initRabbitMq({
    ["@connect_transport"]: async (
      { room_id, dtlsParameters, peer_id, direction },
      user_id,
      reply,
      errBack
    ) => {
      if (!rooms[room_id]?.state[peer_id]) {
        errBack();
        return;
      }
      const { state } = rooms[room_id];
      const transport = direction === "recv"
          ? state[peer_id].recvTransport
          : state[peer_id].sendTransport;

      if (!transport) {
        // errBack();
        return;
      }
      try {
        await transport.connect({ dtlsParameters });
      } catch (e) {
        log(`@connect_transport_${direction}_error`, e);
        reply({
          act: `@connect_transport_${direction}_done`,
          user_id,
          dt: { error: e.message, room_id },
        });
        reply({
          act: "error",
          dt: "error connecting to voice server | " + e.message,
          user_id,
        });
        return;
      }
      log("connect to transport done", transport.appData);
      reply({
        act: `@connect_transport_${direction}_done`,
        user_id,
        dt: { room_id },
      });
    },

    ["@send_track"]: async (
      data,
      user_id,
      reply,
      errBack
    ) => {
      const {
        room_id,
        transportId,
        direction,
        peer_id: my_peer_id,
        kind,
        rtpParameters,
        rtpCapabilities,
        paused,
        appData,
      } = data;
      if (!(room_id in rooms)) {
        errBack();
        return;
      }
      const { state } = rooms[room_id];
      const { sendTransport, producer: previousProducer, consumers } = state[my_peer_id];
      const transport = sendTransport;
      
      if (!transport) {
        errBack();
        return;
      }
      try {
        if (previousProducer) {
          debug('--------closing previous producer and consumer--------');
          previousProducer.close();
          consumers.forEach((c) => c.close());
          // #todo give some time for frontend to get update, but this can be removed
          reply({
            room_id,
            act: "close_consumer",
            dt: { producerId: previousProducer.id, room_id },
          });
        };
        const producer = await transport.produce({
          kind,
          rtpParameters,
          paused,
          appData: { ...appData, peer_id: my_peer_id, transportId },
        });
        rooms[room_id].state[my_peer_id].producer = producer;
        for (const their_peer_id of Object.keys(state)) {
          if (their_peer_id === my_peer_id) {
            continue;
          }
          const peer_transport = state[their_peer_id]?.recvTransport;
          if (!peer_transport) {
            continue;
          };
          try {
            const d = await createConsumer(
              rooms[room_id].router,
              producer,
              rtpCapabilities,
              peer_transport,
              my_peer_id,
              state[their_peer_id]
            );
            log('new peer speaker data):-');
            reply({
              act: "new_peer_speaker",
              dt: { ...d, room_id },
              user_id: their_peer_id,
            });
          } catch (e) {
            log('new_peer_speaker', e.message);
          }
        }
        log('new_peer_speaker ..................!');
        reply({
          act: `@send_track_${direction}_done`,
          user_id,
          dt: {
            id: producer.id,
            room_id,
          },
        });
      } catch (e) {
        reply({
          act: `@send_track_${direction}_done`,
          user_id,
          dt: {
            error: e.message,
            room_id,
          },
        });
        reply({
          act: "error",
          dt: "error connecting to voice server | " + e.message,
          user_id,
        });
        return;
      }
    },

    ["@recv_tracks"]: async (
      { room_id, peer_id: myPeerId, rtpCapabilities },
      user_id,
      reply,
      errBack
    ) => {

      if (!rooms[room_id].state[myPeerId].recvTransport) {
        errBack();
        return;
      }

      const { state, router } = rooms[room_id];
      const transport = state[myPeerId].recvTransport;
      if (!transport) {
        errBack();
        return;
      }

      const consumerParametersArr = [];

      for (const theirPeerId of Object.keys(state)) {
        const peerState = state[theirPeerId];
        if (theirPeerId === myPeerId || !peerState || !peerState.producer) {
          continue;
        }
        try {
          const { producer } = peerState;
          consumerParametersArr.push(
            await createConsumer(
              router,
              producer,
              rtpCapabilities,
              transport,
              myPeerId,
              state[theirPeerId]
            )
          );
        } catch (e) {
          log(e.message);
          continue;
        }
      } 
      reply({
        act: "@recv_tracks_done",
        user_id,
        dt: { consumerParametersArr, room_id },
      });
    },

    ["create_room"]: ({room_id}, user_id, reply) => {
      if (!(room_id in rooms)) {
        rooms[room_id] = createRoom();
      }
      reply({ act: "room_created", dt: { room_id }, user_id });
    },

    ["join_room_as_listener"]: async ({room_id, peer_id}, user_id, reply) => {
      if (!(room_id in rooms)) {
        rooms[room_id] = createRoom();
      }
      log("joined room as listener", peer_id);
      const { state, router } = rooms[room_id];
      const recvTransport = await createTransport("recv", router, peer_id);
      if (state[peer_id]) {
        closePeer(state[peer_id]);
      }
      rooms[room_id].state[peer_id] = {
        recvTransport,
        consumers: [],
        producer: null,
        sendTransport: null,
      };

      reply({
        act: "joined_as_listener",
        dt: {
          room_id,
          peer_id,
          routerRtpCapabilities: rooms[room_id].router.rtpCapabilities,
          recvTransportOptions: transportToOptions(recvTransport),
        },
        user_id,
      });
    },

    ["join_as_speaker"]: async ({ room_id, peer_id }, user_id, reply) => {
      if (!(room_id in rooms)) {
        rooms[room_id] = createRoom();
      }
      log("join-as-new-speaker", peer_id, "to room id", room_id);
      const { state, router } = rooms[room_id];
      // create both recv and send transport for the user as a speaker
      const [recvTransport, sendTransport] = await Promise.all([
        createTransport("recv", router, peer_id),
        createTransport("send", router, peer_id),
      ]);
      if (state[peer_id]) {
        closePeer(state[peer_id]);
      }
      rooms[room_id].state[peer_id] = {
        recvTransport: recvTransport,
        sendTransport: sendTransport,
        consumers: [],
        producer: null,
      };
      reply({
        act: "joined_as_speaker",
        dt: {
          room_id,
          peer_id,
          routerRtpCapabilities: rooms[room_id].router.rtpCapabilities,
          recvTransportOptions: transportToOptions(recvTransport),
          sendTransportOptions: transportToOptions(sendTransport),
        },
        user_id,
      });
    },

    ["add_speaker"]: async ({ room_id, peer_id }, user_id, reply, errBack) => {
      if (!rooms[room_id]?.state[peer_id]) {
        errBack();
        return;
      }
      log("add a speaker", peer_id);
      const { router } = rooms[room_id];
      const sendTransport = await createTransport("send", router, peer_id);
      rooms[room_id].state[peer_id].sendTransport?.close();
      rooms[room_id].state[peer_id].sendTransport = sendTransport;
      reply({
        act: "added_a_speaker",
        dt: {
          sendTransportOptions: transportToOptions(sendTransport),
          room_id,
        },
        user_id,
      });
    },

    ["leave_room"]: async ({ room_id, peer_id }, user_id, reply) => {
      if (room_id in rooms) {
        if (peer_id in rooms[room_id].state) {
          closePeer(rooms[room_id].state[peer_id]);
          delete rooms[room_id].state[peer_id];
          // return;
        }
        if (Object.keys(rooms[room_id].state).length === 0) {
          if (!(room_id in rooms)) {
            return;
          }
          delete rooms[room_id];
        }
        reply({ user_id, act: "good_bye_room", dt: { room_id } });
      }
    },

    ["destroy_room"]: ({ room_id }, user_id, reply) => {
      if (room_id in rooms) {
        for (const peer of Object.values(rooms[room_id].state)) {
          closePeer(peer);
        }
        if (!(room_id in rooms)) {
          return;
        }
        delete rooms[room_id];
        reply({ user_id, act: "room_deleted", dt: { room_id } });
      }
    },

    ["remove_speaker"]: ({ room_id, peer_id }, user_id, reply) => {
      if (room_id in rooms) {
        const peer = rooms[room_id].state[peer_id];
        peer?.producer?.close();
        peer?.sendTransport?.close();
      }

      reply({user_id, act: "speaker_removed", dt: {room_id}})
    },
  });

})();

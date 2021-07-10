"use strict";
const closePeer = (state) => {
    state.producer?.close();
    state.recvTransport?.close();
    state.sendTransport?.close();
    state.consumers.forEach((c) => c.close());
};
module.exports = closePeer;
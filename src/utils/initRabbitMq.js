"use strict";
const amqp = require('amqplib');
const debugModule = require('debug');

const log = debugModule("rabbitMq:index");
const retryInterval = 5000;
const startRabbit = async (handler) => {
    let conn
    try {
      conn = await amqp.connect(process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672");
      log('rabbitMQ connected successfully')
    } catch (err) {
      console.error("Unable to connect to RabbitMQ: ", err);
      setTimeout(async () => await startRabbit(handler), retryInterval);
      return;
    }

    conn.on("close", async function (err) {
      console.error("Rabbit connection closed with error: ", err);
      setTimeout(async () => await startRabbit(handler), retryInterval);
    });
  
    const ch = await conn.createChannel();

  const sendQueue = "soda_queue"; // consumed by soda sever
  const receiveQueue = "wine_queue"; // consumed by wine sever
  const onlineQueue = "soda_online_queue";

  await Promise.all([
    ch.assertQueue(sendQueue),
    ch.assertQueue(receiveQueue),
    ch.assertQueue(onlineQueue)
  ]);

  await ch.purgeQueue(receiveQueue);

  const reply = (obj) => {
    console.log("the queue object to send",obj);
    ch.sendToQueue(sendQueue, Buffer.from(JSON.stringify(obj)));
  };

  await ch.consume(
    receiveQueue,
    async (e) => {
      const m = e === null || e === void 0 ? void 0 : e.content.toString();
      if(m){
        let data;
        try {
          data = JSON.parse(m);
        } catch (err) {
          console.log(err);
        }
        if (data && data.act && data.act in handler) {
          const { dt: handler_dt, act: action, user_id } = data;
          try {
            handler[action](handler_dt, user_id, reply, ()=>{
              reply({
                act: `error-${action}`,
                dt:
                  "The voice server is probably redeploying, it should reconnect in a few seconds. If not, try refreshing.",
                user_id: user_id,
              });
            });
          } catch (err) {
            console.log(err);
          }
        }
      }
    },
    {noAck: true}
  );

  ch.sendToQueue(
    onlineQueue,
    Buffer.from(JSON.stringify({ act: "online" }))
  );
}
module.exports=startRabbit;
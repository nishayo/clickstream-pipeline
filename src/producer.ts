import { Kafka } from "kafkajs";

const kafka = new Kafka({ brokers: ["localhost:9092"] });
const producer = kafka.producer();

async function sendMessage(event: object) {
  await producer.send({
    topic: "clickstream",
    messages: [{ value: JSON.stringify(event) }],
  });
}

async function run() {
    await producer.connect();
    setInterval(async () => {
      const event = {
        user_id: Math.floor(Math.random() * 1000),
        event_type: ["click", "scroll", "purchase", "view"][Math.floor(Math.random() * 4)],
        url: `https://example.com/${["home", "about", "learn", "pricing", "contact", "blog", "faq"][Math.floor(Math.random() * 7)]}`,
        timestamp: Date.now(),
      };
      await sendMessage(event);
      console.log("Sent:", event);
    }, 2000);
}
  
run();

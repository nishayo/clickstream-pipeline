import { Kafka } from "kafkajs";

const kafka = new Kafka({ brokers: ["kafka:9092"] });
const producer = kafka.producer();

interface Event {
  user_id: number;
  event_type: 'click' | 'scroll' | 'purchase' | 'view';
  url: string;
  timestamp: number;
}

const EVENT_TYPES = ['click', 'scroll', 'purchase', 'view'] as const;
const URLS = [
  'home', 'about', 'learn', 'pricing', 
  'contact', 'blog', 'faq'
] as const;

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
        event_type: EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)],
        url: URLS[Math.floor(Math.random() * URLS.length)],
        timestamp: Date.now(),
      };
      await sendMessage(event);
      console.log("Sent:", event);
    }, 2000);
}
  
run();

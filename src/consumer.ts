import { Kafka } from "kafkajs";
import pkg from 'pg';
const { Client } = pkg;
import * as Minio from "minio";

const kafka = new Kafka({ brokers: ["localhost:9092"] });
const consumer = kafka.consumer({ groupId: "clickstream-group" });

const pgClient = new Client({ user: "user", password: "password", database: "clickstream", host: "localhost" });
pgClient.connect();

const minioClient = new Minio.Client({
  endPoint: "localhost",
  port: 9000,
  useSSL: false,
  accessKey: "minioadmin",
  secretKey: "minioadmin",
});

async function createMinIOBucket() {
  const bucketName = "clickstream-storage";
  const exists = await minioClient.bucketExists(bucketName);
  if (!exists) {
    await minioClient.makeBucket(bucketName);
    console.log(`Bucket '${bucketName}' created`);
  }
}

async function createTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS events (
      user_id INT,
      event_type TEXT,
      url TEXT,
      timestamp BIGINT
    );
  `;
  await pgClient.query(query);
  console.log("Table 'events' ensured to exist.");
}

async function storeToMinIO(event: object) {
  const objectName = `scroll_event_${Date.now()}.json`;
  await minioClient.putObject("clickstream-storage", objectName, JSON.stringify(event));
}

async function storeToPostgreSQL(event: any) {
  await pgClient.query("INSERT INTO events (user_id, event_type, url, timestamp) VALUES ($1, $2, $3, $4)", 
    [event.user_id, event.event_type, event.url, event.timestamp]);
}

async function run() {
  await createMinIOBucket();
  await createTable(); // Ensure the table exists before consuming messages
  await consumer.connect();
  await consumer.subscribe({ topic: "clickstream", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value!.toString());
      console.log("Processing:", event);

      if (event.event_type === "scroll") {
        await storeToMinIO(event);
      } else {
        await storeToPostgreSQL(event);
      }
    },
  });
}

run();

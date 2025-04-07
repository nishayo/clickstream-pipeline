import { Kafka } from "kafkajs";
import pkg from 'pg';
const { Client } = pkg;
import * as Minio from "minio";
import client from 'prom-client';

const kafka = new Kafka({ brokers: ["kafka:9092"] });
const consumer = kafka.consumer({ groupId: "clickstream-group" });

const pgClient = new Client({ user: "user", password: "password", database: "clickstream", host: "postgres" });
pgClient.connect();

const minioClient = new Minio.Client({
  endPoint: "minio",
  port: 9000,
  useSSL: false,
  accessKey: "minioadmin",
  secretKey: "minioadmin",
});

const eventProcessingDuration = new client.Histogram({
  name: "event_processing_duration_seconds",
  help: "Time taken to process events",
  buckets: [0.1, 0.5, 1, 2, 5],
});

const eventsByType = new client.Counter({
  name: "events_processed_total",
  help: "Total number of events processed by type",
  labelNames: ['event_type'],
});

const failedEvents = new client.Counter({
  name: "failed_events_total",
  help: "Number of failed event processing attempts",
  labelNames: ['stage'],
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
      const end = eventProcessingDuration.startTimer();
      try {
        const event = JSON.parse(message.value!.toString());
        console.log("Processing:", event);

        eventsByType.inc({ event_type: event.event_type });

        if (event.event_type === "scroll") {
          await storeToMinIO(event);
        } else {
          await storeToPostgreSQL(event);
        }
        end(); // Record processing duration
      } catch (error) {
        failedEvents.inc({ stage: 'consumer' });
        console.error('Failed to process message:', error);
      }
    },
  });
}

run();

import pkg from 'pg';
const { Client } = pkg;
import * as Minio from "minio";

const pgClient = new Client({
  user: "user",
  password: "password",
  database: "clickstream",
  host: "localhost",
});
pgClient.connect();

const minioClient = new Minio.Client({
  endPoint: "localhost",
  port: 9000,
  useSSL: false,
  accessKey: "minioadmin",
  secretKey: "minioadmin",
});

// Ensure the table exists
async function setupDatabase() {
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS scroll_events (
      url TEXT PRIMARY KEY,
      scroll_count INT DEFAULT 0
    )
  `);
}

// Process scroll data and store insights in PostgreSQL
async function processScrollData() {
  return new Promise<void>((resolve, reject) => {
    const objectsStream = minioClient.listObjects("clickstream-storage", "", true);
    const scrollCounts: Record<string, number> = {};

    objectsStream.on("data", async (obj) => {
      try {
        if (!obj.name) {
          console.error("Skipping object with undefined name");
          return;
        }
        console.log("obj : ", obj);
        const dataStream = await minioClient.getObject("clickstream-storage", obj.name);
        console.log("dataStream : ", dataStream);

        const event = JSON.parse(await streamToString(dataStream));
        console.log("event : ", event);

        scrollCounts[event.url] = (scrollCounts[event.url] || 0) + 1;
        
        // Delete after processing
        await minioClient.removeObject("clickstream-storage", obj.name);
      } catch (err) {
        console.error(`Error processing object: ${obj.name}`, err);
      }
    });

    objectsStream.on("end", async () => {
      console.log("Processed all objects:", scrollCounts);

      try {
        for (const [url, count] of Object.entries(scrollCounts)) {
          await pgClient.query(
            `INSERT INTO scroll_events (url, scroll_count)
             VALUES ($1, $2)
             ON CONFLICT (url)
             DO UPDATE SET scroll_count = scroll_events.scroll_count + $2`,
            [url, count]
          );
        }
      } catch (err) {
        console.error("Error inserting into PostgreSQL:", err);
      }

      resolve();
    });

    objectsStream.on("error", (err) => {
      console.error("Error listing objects:", err);
      reject(err);
    });
  });
}

// Convert stream to string
function streamToString(stream: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    stream.on("data", (chunk: any) => (data += chunk.toString()));
    stream.on("end", () => resolve(data));
    stream.on("error", reject);
  });
}

// Setup DB and run processScrollData every 1 minute
setupDatabase().then(() => {
  setInterval(processScrollData, 1000);
});

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
      scroll_count INT DEFAULT 0,
      user_id INT,
      timestamp BIGINT
    )
  `);
}

// Process scroll data and store insights in PostgreSQL
async function processScrollData() {
  return new Promise<void>((resolve, reject) => {
    const objectsStream = minioClient.listObjects("clickstream-storage", "", true);
    const scrollCounts: Record<string, { count: number, user_id: number, timestamp: number }> = {};
    const promises: Promise<void>[] = [];  // Track all async operations

    objectsStream.on("data", (obj) => {
      const promise = (async () => {
        try {
          if (!obj.name) {
            console.error("Skipping object with undefined name");
            return;
          }
          console.log("Processing object:", obj.name);
          const dataStream = await minioClient.getObject("clickstream-storage", obj.name);

          const event = JSON.parse(await streamToString(dataStream));
          console.log("Event data:", event);

          if (!scrollCounts[event.url]) {
            scrollCounts[event.url] = { count: 0, user_id: event.user_id, timestamp: event.timestamp };
          }
          scrollCounts[event.url].count += 1;
          console.log("Updated scrollCounts:", scrollCounts);

          // Delete after processing
          await minioClient.removeObject("clickstream-storage", obj.name);
        } catch (err) {
          console.error(`Error processing object: ${obj.name}`, err);
        }
      })();
      promises.push(promise);
    });

    objectsStream.on("end", async () => {
      await Promise.all(promises); // Ensure all "data" handlers finish

      console.log("Processed all objects:", scrollCounts);

      try {
        for (const [url, data] of Object.entries(scrollCounts)) {
          const query = `
            INSERT INTO scroll_events (url, scroll_count, user_id, timestamp)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (url)
            DO UPDATE SET scroll_count = scroll_events.scroll_count + $2
          `;
          const values = [url, data.count, data.user_id, data.timestamp];
          console.log("Executing query:", query, "with values:", values);

          await pgClient.query(query, values);
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

// Setup DB and run processScrollData every 15 seconds
setupDatabase().then(() => {
  setInterval(processScrollData, 15000);
});

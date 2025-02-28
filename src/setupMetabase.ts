import axios from "axios";

const METABASE_URL = "http://localhost:3000";
const METABASE_USER = "admin@example.com";
const METABASE_PASS = "password";

async function setupMetabase() {
  const loginRes = await axios.post(`${METABASE_URL}/api/session`, {
    username: METABASE_USER,
    password: METABASE_PASS,
  });

  const token = loginRes.data.id;
  const headers = { "X-Metabase-Session": token };

  // Add PostgreSQL database
  await axios.post(
    `${METABASE_URL}/api/database`,
    {
      name: "ClickstreamDB",
      engine: "postgres",
      details: { host: "localhost", port: 5432, dbname: "clickstream", user: "user", password: "password" },
    },
    { headers }
  );

  // Create visualization
  const queryRes = await axios.post(
    `${METABASE_URL}/api/card`,
    {
      name: "Event Counts",
      dataset_query: {
        database: 1,
        query: { "source-table": "events", aggregation: [["count"]], breakout: ["event_type"] },
      },
      visualization_settings: { chart_type: "bar" },
    },
    { headers }
  );

  console.log("Metabase setup complete! Dashboard:", `${METABASE_URL}/question/${queryRes.data.id}`);
}

setupMetabase();

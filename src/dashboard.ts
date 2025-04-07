import express from 'express';
import { Kafka } from 'kafkajs';
import pkg from 'pg';
import * as Minio from 'minio';
import client from 'prom-client';
import fs from 'fs';
import { eventsByType } from './index.js';

const { Client } = pkg;
const app = express();

// Setup WebSocket for real-time updates
import { Server } from 'socket.io';
import http from 'http';
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static('public'));

// Add a test route to verify server is running
app.get('/', (req, res) => {
  res.send(`
    ${fs.readFileSync('./public/index.html', 'utf8')}
    <script type="text/javascript">${clientScript}</script>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Setup clients
const kafka = new Kafka({ brokers: ['kafka:9092'] });
const pgClient = new Client({
  user: 'user',
  password: 'password',
  database: 'clickstream',
  host: 'postgres'
});

const minioClient = new Minio.Client({
  endPoint: 'minio',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin'
});

// Create a Registry
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Metrics endpoint and UI
app.get('/metrics-ui', (req, res) => {
    res.sendFile('metrics.html', { root: 'public' });
});

app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        res.status(500).end(err);
    }
});

// Dashboard routes
app.get('/api/stats', async (req, res) => {
  try {
    const eventCounts = await pgClient.query('SELECT event_type, COUNT(*) from events GROUP BY event_type');
    const scrollCounts = await pgClient.query('SELECT SUM(scroll_count) from scroll_events');
    const bucketObjects = await new Promise((resolve) => {
      let count = 0;
      const stream = minioClient.listObjects('clickstream-storage', '', true);
      stream.on('data', () => count++);
      stream.on('end', () => resolve(count));
    });

    res.json({
      events: eventCounts.rows,
      scrolls: scrollCounts.rows[0],
      pendingScrolls: bucketObjects
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// WebSocket updates
io.on('connection', (socket) => {
    console.log('Client connected to WebSocket');
    socket.on('disconnect', () => {
        console.log('Client disconnected from WebSocket');
    });
});

// Start consuming Kafka messages to broadcast updates
const consumer = kafka.consumer({ groupId: 'dashboard-group' });
await consumer.connect();
await consumer.subscribe({ topic: 'clickstream' });
await consumer.run({
    eachMessage: async ({ message }) => {
        const event = JSON.parse(message.value!.toString());
        io.emit('event', event);
        eventsByType.inc({ event_type: event.event_type });
    },
});

// After client initialization
await pgClient.connect();
console.log('Connected to PostgreSQL');

// Start the server only after connections are established
export function startServer(port: number) {
  return new Promise((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Dashboard server running on http://localhost:${port}`);
      console.log('📁 Serving static files from:', process.cwd() + '/public');
      resolve(server);
    });
  });
}

export default { startServer };

interface EventStats {
    click: number;
    scroll: number;
    purchase: number;
    view: number;
}

// Client-side code to be injected into index.html
const clientScript = `
// Add Plotly type definition
declare const Plotly: any;

const socket = io();
const eventsLog = document.getElementById('events-log');
let eventStats: EventStats = {
    click: 0,
    scroll: 0,
    purchase: 0,
    view: 0
};

socket.on('event', (event) => {
    const logEntry = document.createElement('div');
    logEntry.className = 'py-1 border-b';
    logEntry.textContent = \`\${new Date().toISOString()} - \${event.event_type} - \${event.url}\`;
    eventsLog?.prepend(logEntry);

    eventStats[event.event_type]++;
    updateCharts();
});

function updateCharts() {
    const pieData = [{
        values: Object.values(eventStats),
        labels: Object.keys(eventStats),
        type: 'pie'
    }];
    
    Plotly.newPlot('event-distribution', pieData);

    fetch('/api/stats')
        .then(res => res.json())
        .then(stats => {
            const metricsData = [{
                type: 'bar',
                x: ['Processed Events', 'Pending Scroll Events'],
                y: [stats.events.length, stats.pendingScrolls]
            }];
            
            Plotly.newPlot('pipeline-metrics', metricsData);
        });
}

updateCharts();
setInterval(updateCharts, 5000);
`; 
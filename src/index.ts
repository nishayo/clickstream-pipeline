import { spawn } from "child_process";
import express, { Request, Response } from "express";
import client from "prom-client";
import dashboardServer from './dashboard.js';

// Initialize Prometheus Registry
const register = new client.Registry();

// Pipeline metrics
const pipelineExecutionCount = new client.Counter({
  name: "pipeline_execution_count",
  help: "Number of times the pipeline has been executed",
});

const eventProcessingDuration = new client.Histogram({
  name: "event_processing_duration_seconds",
  help: "Time taken to process events",
  buckets: [0.1, 0.5, 1, 2, 5],
});

export const eventsByType = new client.Counter({
  name: "events_processed_total",
  help: "Total number of events processed by type",
  labelNames: ['event_type'],
});

const failedEvents = new client.Counter({
  name: "failed_events_total",
  help: "Number of failed event processing attempts",
  labelNames: ['stage'], // producer, consumer, batch_processor
});

const minioObjectCount = new client.Gauge({
  name: "minio_objects_count",
  help: "Number of objects in MinIO storage",
});

const kafkaLagMetric = new client.Gauge({
  name: "kafka_consumer_lag",
  help: "Kafka consumer lag in messages",
});

// Register all metrics
register.registerMetric(pipelineExecutionCount);
register.registerMetric(eventProcessingDuration);
register.registerMetric(eventsByType);
register.registerMetric(failedEvents);
register.registerMetric(minioObjectCount);
register.registerMetric(kafkaLagMetric);

// Set up Express app for exposing metrics
const app = express();

// Expose Prometheus metrics at `/metrics`
app.get("/metrics", async (req: Request, res: Response) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Start Express server
const METRICS_PORT = 4001;
app.listen(METRICS_PORT, () => {
  console.log(`📊 Metrics server running on http://localhost:${METRICS_PORT}/metrics`);
});

// Function to run a script as a background process
function runScript(scriptPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const process = spawn("node", [scriptPath], { stdio: "inherit" });

    process.on("error", (err: Error) => {
      console.error(`❌ Failed to start ${scriptPath}: ${err.message}`);
      reject(err);
    });

    console.log(`🚀 Started ${scriptPath} successfully.`);
    resolve(); // Resolve immediately since the process runs independently
  });
}

// Main function to start the pipeline
async function runPipeline(): Promise<void> {
  try {
    console.log("🚀 Starting Producer...");
    await runScript("./dist/producer.js"); // Start producer (runs continuously)

    console.log("🚀 Starting Consumer...");
    runScript("./dist/consumer.js"); // Start consumer immediately

    console.log("🚀 Starting Batch Processor...");
    runScript("./dist/batchProcessor.js"); // Start batch processor immediately

    // Start dashboard server
    const PORT = Number(process.env.DASHBOARD_PORT) || 4000;
    await dashboardServer.startServer(PORT);

    // Increment pipeline execution count metric
    pipelineExecutionCount.inc();

    console.log("🎉 Pipeline started successfully!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("🔥 Error in pipeline execution:", error.message);
    } else {
      console.error("🔥 Unknown error in pipeline execution.");
    }
    process.exit(1);
  }
}

// Run the pipeline
runPipeline();

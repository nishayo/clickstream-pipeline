import { spawn } from "child_process";
import express, { Request, Response } from "express";
import client from "prom-client";

// Initialize Prometheus Registry
const register = new client.Registry();

// Custom metric: Pipeline execution count
const pipelineExecutionCount = new client.Counter({
  name: "pipeline_execution_count",
  help: "Number of times the pipeline has been executed",
});
register.registerMetric(pipelineExecutionCount);

// Set up Express app for exposing metrics
const app = express();

// Expose Prometheus metrics at `/metrics`
app.get("/metrics", async (req: Request, res: Response) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Start Express server
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`📊 Metrics server running on http://localhost:${PORT}/metrics`);
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

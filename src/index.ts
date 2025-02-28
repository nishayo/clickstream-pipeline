import { spawn } from "child_process";

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

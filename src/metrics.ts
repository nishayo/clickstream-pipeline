interface MetricDescriptions {
    [key: string]: string;
}

const METRIC_DESCRIPTIONS: MetricDescriptions = {
    'pipeline_execution_count': 'Number of times the pipeline has been started since last deployment',
    'event_processing_duration_seconds': 'Time taken to process each event, distributed across different time buckets',
    'events_processed_total': 'Total number of events processed, broken down by event type',
    'failed_events_total': 'Number of failed event processing attempts in different pipeline stages',
    'minio_objects_count': 'Current number of scroll events waiting to be processed in MinIO storage',
    'kafka_consumer_lag': 'Number of messages waiting to be consumed from Kafka'
};

interface MetricData {
    name: string;
    help: string;
    value: string | number;
}

function createMetricCard({ name, help, value }: MetricData): string {
    return `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center mb-4">
                <h2 class="text-xl font-semibold">${name}</h2>
                <div class="ml-2 relative group">
                    <i class="fas fa-info-circle text-gray-400 hover:text-gray-600"></i>
                    <div class="hidden group-hover:block absolute z-10 w-64 p-2 mt-1 text-sm text-white bg-gray-800 rounded-lg">
                        ${help}
                    </div>
                </div>
            </div>
            <div class="text-3xl font-bold text-blue-600">${value}</div>
        </div>
    `;
}

function updateMetrics(): void {
    fetch('/metrics')
        .then(res => res.text())
        .then(metricsText => {
            const container = document.getElementById('metrics-container');
            if (!container) return;
            
            container.innerHTML = '';
            
            const metrics = metricsText.split('\n')
                .filter(line => !line.startsWith('#') && line.trim());
                
            metrics.forEach(metric => {
                const [name, value] = metric.split(' ');
                const help = METRIC_DESCRIPTIONS[name] || 'No description available';
                container.innerHTML += createMetricCard({ name, help, value });
            });
        });
}

// Update metrics every 5 seconds
updateMetrics();
setInterval(updateMetrics, 5000); 
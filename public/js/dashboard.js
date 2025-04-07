const socket = io();
const eventsLog = document.getElementById('events-log');
let eventStats = {
  click: 0,
  scroll: 0,
  purchase: 0,
  view: 0
};

// Handle real-time events
socket.on('event', (event) => {
  // Update log
  const logEntry = document.createElement('div');
  logEntry.className = 'py-1 border-b';
  logEntry.textContent = `${new Date().toISOString()} - ${event.event_type} - ${event.url}`;
  eventsLog.prepend(logEntry);

  // Update stats
  eventStats[event.event_type]++;
  updateCharts();
});

// Update charts
function updateCharts() {
  // Event distribution pie chart
  const pieData = [{
    values: Object.values(eventStats),
    labels: Object.keys(eventStats),
    type: 'pie'
  }];
  
  Plotly.newPlot('event-distribution', pieData);

  // Fetch and update pipeline metrics
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

// Initial load
updateCharts();
setInterval(updateCharts, 5000); 
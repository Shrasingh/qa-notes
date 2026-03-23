const cluster = require('cluster');
const os = require('os');
if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  console.log(`Worker ${process.pid} running`);
  require('http')
    .createServer((req, res) => {
      res.end(`Handled by ${process.pid}`);
    })
    .listen(3000);
}

// Import Worker class from worker_threads module
const { Worker } = require('worker_threads');

// Create a new Worker (a separate thread)
const worker = new Worker(`
  // Inside the worker thread:

  // Import parentPort to communicate with main thread
  const { parentPort } = require('worker_threads');

  // Send a message from worker to main thread
  parentPort.postMessage("Hello from worker");
`, { eval: true }); // eval: true allows running this code as a string

// Listen for messages coming FROM the worker
worker.on('message', (msg) => {
  // Print the message received from worker
  console.log(msg);
});
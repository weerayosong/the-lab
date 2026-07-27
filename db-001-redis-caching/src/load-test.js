import autocannon from "autocannon";

const BASE_URL = "http://localhost:3000";

// เลือก endpoint ที่ต้องการทดสอบ
const endpoint = process.argv[2] || "/api/sales/direct/2023/6";
const connections = parseInt(process.argv[3]) || 10;
const duration = parseInt(process.argv[4]) || 10;

console.log(`🔥 Load Testing: ${BASE_URL}${endpoint}`);
console.log(`   Connections: ${connections}`);
console.log(`   Duration: ${duration}s\n`);

const instance = autocannon({
  url: `${BASE_URL}${endpoint}`,
  connections,
  duration,
  headers: {
    "Content-Type": "application/json",
  },
});

// Track progress
autocannon.track(instance, {
  renderProgressBar: true,
  renderResultsTable: true,
});

instance.on("done", (result) => {
  console.log("\n✅ Test Complete!\n");
  console.log("📊 Summary:");
  console.log(`   Requests/sec: ${result.requests.average.toFixed(2)}`);
  console.log(`   Latency Avg: ${result.latency.average.toFixed(2)} ms`);
  console.log(`   Latency P99: ${result.latency.p99.toFixed(2)} ms`);
  console.log(`   Total Requests: ${result.requests.total}`);
});

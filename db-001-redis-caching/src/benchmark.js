import autocannon from "autocannon";
import { writeFileSync } from "fs";

const BASE_URL = "http://localhost:3000";
const DURATION = 30; // 30 วินาที

// ฟังก์ชันรันการทดสอบ
async function runTest(name, url, connections = 10) {
  console.log(`\n🔬 Running: ${name}`);
  console.log(`   URL: ${url}`);
  console.log(`   Connections: ${connections}`);
  console.log("   Duration: 30s\n");

  const result = await autocannon({
    url,
    connections,
    duration: DURATION,
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 30,
  });

  return {
    name,
    url,
    connections,
    timestamp: new Date().toISOString(),
    metrics: {
      total_requests: result.requests.total,
      requests_per_second: result.requests.average,
      latency_avg_ms: result.latency.average,
      latency_p99_ms: result.latency.p99,
      latency_max_ms: result.latency.max,
      errors: result.errors,
      timeouts: result.timeouts,
      throughput_bytes: result.throughput.average,
    },
  };
}

// ฟังก์ชันแสดงผลลัพธ์
function printResults(results) {
  console.log("\n" + "=".repeat(80));
  console.log("📊 BENCHMARK RESULTS - DIRECT DB QUERY (BASELINE)");
  console.log("=".repeat(80) + "\n");

  results.forEach((r) => {
    console.log(`\n🔹 ${r.name}`);
    console.log(`   URL: ${r.url}`);
    console.log("   ─────────────────────────────────────────────");
    console.log(
      `   Total Requests:     ${r.metrics.total_requests.toLocaleString()}`,
    );
    console.log(
      `   Requests/sec:       ${r.metrics.requests_per_second.toFixed(2)} req/s`,
    );
    console.log(
      `   Avg Latency:        ${r.metrics.latency_avg_ms.toFixed(2)} ms`,
    );
    console.log(
      `   P99 Latency:        ${r.metrics.latency_p99_ms.toFixed(2)} ms`,
    );
    console.log(
      `   Max Latency:        ${r.metrics.latency_max_ms.toFixed(2)} ms`,
    );
    console.log(`   Errors:             ${r.metrics.errors}`);
    console.log(`   Timeouts:           ${r.metrics.timeouts}`);
    console.log(
      `   Throughput:         ${(r.metrics.throughput_bytes / 1024).toFixed(2)} KB/s`,
    );
  });

  // Save results to JSON
  const filename = `benchmark-results-${new Date().toISOString().replace(/:/g, "-")}.json`;
  writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${filename}`);
}

// Main test suite
async function runDirectDBBaseline() {
  console.log("🚀 Starting Direct DB Query Benchmark...\n");

  const results = [];

  try {
    // Test 1: Monthly Sales Report (Medium complexity)
    results.push(
      await runTest(
        "Monthly Sales Report",
        `${BASE_URL}/api/sales/direct/2023/6`,
        10,
      ),
    );

    // Test 2: Top Products (Medium-High complexity)
    results.push(
      await runTest(
        "Top Products by Month",
        `${BASE_URL}/api/sales/direct/top-products/2023/6`,
        10,
      ),
    );

    // Test 3: Range Query (High complexity)
    results.push(
      await runTest(
        "Date Range Query (30 days)",
        `${BASE_URL}/api/sales/direct/range?start_date=2023-06-01&end_date=2023-06-30`,
        5, // lower connections for heavy query
      ),
    );

    // Test 4: Overall Statistics (Very High complexity - full scan)
    results.push(
      await runTest(
        "Overall Statistics",
        `${BASE_URL}/api/sales/direct/stats`,
        3, // very low connections to prevent DB overload
      ),
    );

    // Test 5: Light Query - Single Day
    results.push(
      await runTest(
        "Single Day Query",
        `${BASE_URL}/api/sales/direct/range?start_date=2023-06-15&end_date=2023-06-15`,
        20,
      ),
    );

    printResults(results);
    return results;
  } catch (error) {
    console.error("❌ Benchmark failed:", error.message);
  }
}

// Run if called directly
runDirectDBBaseline();

import autocannon from "autocannon";
import { writeFileSync, readFileSync } from "fs";

const BASE_URL = "http://localhost:3001";
const DURATION = 30;

async function runTest(name, url, connections = 10) {
  console.log(`\n🔬 Testing Cached: ${name}`);

  const result = await autocannon({
    url,
    connections,
    duration: DURATION,
    headers: { "Content-Type": "application/json" },
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
    },
  };
}

async function runCachedBenchmark() {
  console.log("🚀 Starting CACHED API Benchmark...\n");

  const results = [];

  // Warm up cache first
  console.log("🔥 Warming up cache...");
  await fetch(`${BASE_URL}/api/sales/cached/2023/6`);
  await fetch(`${BASE_URL}/api/sales/cached/top-products/2023/6`);
  await fetch(
    `${BASE_URL}/api/sales/cached/range?start_date=2023-06-01&end_date=2023-06-30`,
  );
  await fetch(`${BASE_URL}/api/sales/cached/stats`);
  console.log("✅ Cache warmed up\n");

  // Run tests
  results.push(
    await runTest(
      "Cached Monthly Report",
      `${BASE_URL}/api/sales/cached/2023/6`,
      50,
    ),
  );
  results.push(
    await runTest(
      "Cached Top Products",
      `${BASE_URL}/api/sales/cached/top-products/2023/6`,
      50,
    ),
  );
  results.push(
    await runTest(
      "Cached Range Query",
      `${BASE_URL}/api/sales/cached/range?start_date=2023-06-01&end_date=2023-06-30`,
      30,
    ),
  );
  results.push(
    await runTest("Cached Stats", `${BASE_URL}/api/sales/cached/stats`, 50),
  );

  // Print comparison
  console.log("\n" + "=".repeat(80));
  console.log("📊 CACHED API BENCHMARK RESULTS");
  console.log("=".repeat(80));

  results.forEach((r) => {
    console.log(`\n🔹 ${r.name}`);
    console.log(
      `   Requests/sec:  ${r.metrics.requests_per_second.toFixed(2)} req/s`,
    );
    console.log(`   Avg Latency:   ${r.metrics.latency_avg_ms.toFixed(2)} ms`);
    console.log(`   P99 Latency:   ${r.metrics.latency_p99_ms.toFixed(2)} ms`);
  });

  // Save results
  const filename = `cached-benchmark-${new Date().toISOString().replace(/:/g, "-")}.json`;
  writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${filename}`);
}

runCachedBenchmark();

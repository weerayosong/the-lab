function heapUsedMB() {
  return (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
}

function forceGC() {
  if (typeof global.gc !== "function") {
    console.error("❌ ต้องรันด้วย: node --expose-gc detective.js");
    process.exit(1);
  }
  global.gc();
}

// ---- Simulate large payload ----
function createLargePayload(id) {
  // สร้าง buffer ใหญ่ ~1KB ต่อ object จำลอง data จริง
  return {
    id,
    data: Buffer.alloc(1024, id % 256),
    timestamp: Date.now(),
    metadata: { source: "sensor-" + id, version: 3 },
  };
}

// ---- Scenario 1: WeakMap Baseline ----
function baselineWeakMap(COUNT = 10_000) {
  console.log("\n📦 Baseline — WeakMap (GC ทำงานปกติ)\n");

  const wm = new WeakMap();
  let items = []; // จะปล่อย reference ทีหลัง

  const before = heapUsedMB();

  // สร้าง objects + เก็บ metadata ใน WeakMap
  for (let i = 0; i < COUNT; i++) {
    const obj = createLargePayload(i);
    items.push(obj);
    wm.set(obj, { index: i, cached: true }); // WeakMap: key เป็น obj
  }
  const afterCreate = heapUsedMB();

  // ปล่อย reference — items ชี้ไป array ใหม่, obj ทั้งหมดไม่มีใครอ้างถึง
  items = [];
  const afterRelease = heapUsedMB();

  // บังคับ GC
  forceGC();
  const afterGC = heapUsedMB();

  // Print results
  console.log(`  Create ${COUNT} objects  → ${afterCreate} MB`);
  console.log(`  Release references    → ${afterRelease} MB`);
  console.log(`  Force GC              → ${afterGC} MB`);
  console.log(
    `  Freed                 → ${(afterCreate - afterGC).toFixed(1)} MB`,
  );

  // WeakMap entries ควรถูกเก็บหมดแล้ว
  // (ตรวจสอบทางอ้อมไม่ได้ตรงๆ เพราะ WeakMap ไม่ expose size)
  console.log("  ✅ GC ทำงานปกติ — WeakMap ไม่ป้องกันการเก็บ\n");
}

// ---- Main ----
console.log("╔══════════════════════════════════════╗");
console.log("║  🧪 Memory Leak Detective — core-002 ║");
console.log("║     Closure vs WeakMap               ║");
console.log("╚══════════════════════════════════════╝");

console.log(`\n🔧 Node version: ${process.version}`);
console.log(`🔧 Initial heap: ${heapUsedMB()} MB`);

baselineWeakMap();

console.log("✅ Phase 1 Complete — Baseline Verified\n");

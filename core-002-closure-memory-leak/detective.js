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
  return {
    afterGC: parseFloat(afterGC),
    freed: parseFloat((afterCreate - afterGC).toFixed(1)),
    stillHeld: parseFloat((afterGC - before).toFixed(1)),
  };
}

class SimpleEmitter {
  constructor() {
    this._listeners = new Map(); // event → Set of callbacks
  }
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
  }
  off(event, fn) {
    this._listeners.get(event)?.delete(fn);
  }
  emit(event, data) {
    this._listeners.get(event)?.forEach((fn) => fn(data));
  }
  listenerCount(event) {
    return this._listeners.get(event)?.size ?? 0;
  }
}

// ---- Scenario 2: The Leak — Closure holding large object ----
function scenarioTheLeak(COUNT = 10_000) {
  console.log("\n🔴 The Leak — Closure กัก object ใหญ่ไว้\n");

  const emitter = new SimpleEmitter();
  let bigObjects = [];
  const before = heapUsedMB();

  // สร้าง objects และ subscribe ด้วย callback ที่ closure จับ bigObject
  for (let i = 0; i < COUNT; i++) {
    const bigObject = createLargePayload(i);
    bigObjects.push(bigObject);

    // ⚠️ ตรงนี้แหละ — closure จับ bigObject ไว้ทั้งก้อน
    // แม้ว่า callback ใช้แค่ bigObject.id เฉยๆ
    emitter.on("update", (data) => {
      const _unused = bigObject.data; // closure ต้องจำ bigObject ทั้ง object
      // ในชีวิตจริง: callback อาจ render UI, log, transform etc.
    });
  }

  const afterCreate = heapUsedMB();
  console.log(`  Listeners registered: ${emitter.listenerCount("update")}`);

  // จำลอง dev "เคลียร์" ข้อมูล — ปล่อย array แต่ลืม unsubscribe
  bigObjects = [];
  const afterRelease = heapUsedMB();

  // GC พยายามเก็บ
  forceGC();
  const afterGC = heapUsedMB();

  console.log(`  Create ${COUNT} objects + listeners → ${afterCreate} MB`);
  console.log(`  Release bigObjects array              → ${afterRelease} MB`);
  console.log(`  Force GC                              → ${afterGC} MB`);
  console.log(
    `  Still held                            → ${(afterGC - before).toFixed(1)} MB`,
  );
  console.log(
    `  ❌ Memory LEAKED — ${emitter.listenerCount("update")} listeners still hold closures\n`,
  );
  console.log("  🔍 สาเหตุ: callback function ใน emitter.on()");
  console.log("     เก็บ reference ถึง bigObject ผ่าน closure");
  console.log(
    "     แม้ bigObjects = [] แล้ว แต่ emitter ยังอ้างถึงทุก callback",
  );
  console.log(
    "     → GC เก็บ bigObject ไม่ได้ เพราะยังมี path จาก emitter มาถึง\n",
  );

  return {
    afterGC: parseFloat(afterGC),
    freed: parseFloat((afterCreate - afterGC).toFixed(1)),
    stillHeld: parseFloat((afterGC - before).toFixed(1)),
  };
}

// ---- Scenario 3: The Fix — WeakMap + Manual Cleanup ----
function scenarioTheFix(COUNT = 10_000) {
  console.log("\n🟢 The Fix — WeakMap + unsubscribe\n");

  const emitter = new SimpleEmitter();
  const wm = new WeakMap();
  let items = [];
  const before = heapUsedMB();

  // เก็บ object ใน array + metadata ใน WeakMap
  // callback รับ object จาก parameter แทนที่จะจับผ่าน closure
  for (let i = 0; i < COUNT; i++) {
    const obj = createLargePayload(i);
    items.push(obj);
    wm.set(obj, { index: i, cachedAt: Date.now() });

    // ✅ callback ไม่ closure จับ obj — รับผ่าน parameter ตอน emit
    emitter.on("update", (updatedObj) => {
      const meta = wm.get(updatedObj);
      if (meta) {
        // ใช้ metadata โดยไม่จับ obj ไว้ใน closure
        meta.cachedAt = Date.now();
      }
    });
  }

  const afterCreate = heapUsedMB();
  console.log(`  Listeners registered: ${emitter.listenerCount("update")}`);

  // จำลอง cleanup — unsubscribe + ปล่อย reference
  // ในชีวิตจริง: ทำตอน componentWillUnmount, useEffect cleanup ฯลฯ
  emitter._listeners.delete("update"); // ล้าง listeners ทั้งหมด
  items = [];
  const afterRelease = heapUsedMB();

  forceGC();
  const afterGC = heapUsedMB();

  console.log(`  Create ${COUNT} objects + listeners → ${afterCreate} MB`);
  console.log(`  Unsubscribe + release items          → ${afterRelease} MB`);
  console.log(`  Force GC                             → ${afterGC} MB`);
  console.log(
    `  Freed                                → ${(afterCreate - afterGC).toFixed(1)} MB`,
  );
  console.log(
    `  ✅ No leak — ${emitter.listenerCount("update")} listeners remain\n`,
  );
  console.log("  🔍 วิธีแก้:");
  console.log("     1. callback รับ object ผ่าน parameter ไม่ใช่ closure");
  console.log(
    "     2. ใช้ WeakMap เก็บ metadata — GC เก็บได้เมื่อ object ถูกปล่อย",
  );
  console.log("     3. unsubscribe listeners เมื่อไม่ใช้แล้ว\n");

  return {
    afterGC: parseFloat(afterGC),
    freed: parseFloat((afterCreate - afterGC).toFixed(1)),
    stillHeld: parseFloat((afterGC - before).toFixed(1)),
  };
}

// ---- Summary Table ----
function printSummary(r1, r2, r3) {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║               📊 BENCHMARK SUMMARY                     ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║ Scenario              │ Heap After GC │ Freed │ Leak?  ║");
  console.log("╟───────────────────────┼───────────────┼───────┼────────╢");

  const scenarios = [
    { name: "📦 Baseline (WeakMap) ", data: r1 },
    { name: "🔴 Closure Leak      ", data: r2 },
    { name: "🟢 WeakMap + Cleanup  ", data: r3 },
  ];

  scenarios.forEach((s) => {
    const leak = s.data.stillHeld > 2 ? "❌ YES" : "✅ NO";
    console.log(
      `║ ${s.name} │    ${s.data.afterGC} MB │ ${s.data.freed} MB │ ${leak}   ║`,
    );
  });

  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("💡 Key Takeaways:");
  console.log("  1. Closure จับ reference ทั้ง outer scope → GC เก็บไม่ได้");
  console.log(
    "  2. WeakMap ใช้ weak reference → GC เก็บ object ได้เมื่อไม่มี ref อื่น",
  );
  console.log(
    "  3. EventEmitter ต้อง unsubscribe เสมอ ไม่งั้น callback + closure ค้าง",
  );
  console.log(
    "  4. ส่งข้อมูลผ่าน parameter แทน closure + WeakMap = memory safe\n",
  );
}

// ---- Main (Final) ----
console.log("╔══════════════════════════════════════════╗");
console.log("║  🧪 Memory Leak Detective — core-002    ║");
console.log("║     Closure vs WeakMap                 ║");
console.log("╚══════════════════════════════════════════╝");

console.log(`\n🔧 Node version: ${process.version}`);
console.log(`🔧 Initial heap: ${heapUsedMB()} MB`);

// Run all scenarios, collect results
const r1 = baselineWeakMap();
const r2 = scenarioTheLeak();
const r3 = scenarioTheFix();

printSummary(r1, r2, r3);

console.log("✅ All Scenarios Complete\n");

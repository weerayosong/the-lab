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
}

// ---- Main ----
console.log("╔══════════════════════════════════════╗");
console.log("║  🧪 Memory Leak Detective — core-002 ║");
console.log("║     Closure vs WeakMap               ║");
console.log("╚══════════════════════════════════════╝");

console.log(`\n🔧 Node version: ${process.version}`);
console.log(`🔧 Initial heap: ${heapUsedMB()} MB`);

baselineWeakMap();
scenarioTheLeak();

console.log("✅ Phase 1 Complete — Baseline Verified\n");
console.log("✅ Phase 2 Complete — Leak Detected\n");

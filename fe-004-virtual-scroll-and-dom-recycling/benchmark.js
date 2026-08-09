#!/usr/bin/env node

/**
 * ============================================================
 * Phase 4: CLI Benchmark
 * วัดประสิทธิภาพโดยไม่ต้องเปิด Browser
 * ============================================================
 */

const TOTAL_ROWS = 100_000
const ROW_HEIGHT = 49
const VIEWPORT_HEIGHT = 600

// ---------- Data Generator (เหมือนของ browser) ----------
function generateData(count) {
  const firstNames = ['สมชาย', 'วิชัย', 'ประเสริฐ', 'กัญญา', 'นภา', 'ธนพล', 'สุดา', 'มานพ', 'รัตนา', 'ภาสกร']
  const lastNames = ['ใจดี', 'รุ่งเรือง', 'สุขสบาย', 'มั่งมี', 'ศรีสุข', 'วงศ์ใหญ่', 'บุญมา', 'แสงทอง', 'ชัยชนะ', 'ฤทธิ์เดช']
  const statuses = ['active', 'inactive', 'pending']
  
  const data = []
  for (let i = 0; i < count; i++) {
    data.push({
      id: i + 1,
      name: `${firstNames[i % 10]} ${lastNames[Math.floor(i / 10) % 10]}`,
      email: `user${i + 1}@example.com`,
      balance: (Math.random() * 100000).toFixed(2),
      status: statuses[i % 3]
    })
  }
  return data
}

// ---------- Benchmark Helpers ----------
function formatNumber(num) {
  return num.toLocaleString()
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function memoryUsage() {
  const used = process.memoryUsage()
  return {
    heapUsed: used.heapUsed,
    heapTotal: used.heapTotal,
    external: used.external,
    rss: used.rss
  }
}

// ---------- Simulation ----------
console.log('═'.repeat(60))
console.log('Virtual Scroll Benchmark (CLI)')
console.log('═'.repeat(60))
console.log()

// 1. Generate Data
console.log('📦 Step 1: Generating mock data...')
const memBefore = memoryUsage()
const startGen = performance.now()
const mockData = generateData(TOTAL_ROWS)
const endGen = performance.now()
const memAfterGen = memoryUsage()

console.log(`   ✅ Generated ${formatNumber(TOTAL_ROWS)} rows`)
console.log(`   ⏱️  Time: ${(endGen - startGen).toFixed(0)} ms`)
console.log(`   💾 Memory Delta: ${formatBytes(memAfterGen.heapUsed - memBefore.heapUsed)}`)
console.log()

// 2. Simulate Naive Rendering (สร้าง Object แทน DOM Element)
console.log('🔴 Step 2: Simulating Naive Render (100k DOM-like objects)...')
const memBeforeNaive = memoryUsage()
const startNaive = performance.now()

// จำลองการสร้าง DOM elements 100,000 อัน
const fakeDomElements = []
for (let i = 0; i < TOTAL_ROWS; i++) {
  fakeDomElements.push({
    tagName: 'div',
    className: 'grid grid-cols-5 gap-4 px-6 py-3 border-b',
    innerHTML: `<div>${i + 1}</div><div>${mockData[i].name}</div><div>${mockData[i].email}</div><div>${mockData[i].balance}</div><div>${mockData[i].status}</div>`,
    children: 5,
    data: mockData[i]
  })
}

const endNaive = performance.now()
const memAfterNaive = memoryUsage()

console.log(`   ✅ Created ${formatNumber(fakeDomElements.length)} DOM-like objects`)
console.log(`   ⏱️  Time: ${(endNaive - startNaive).toFixed(0)} ms`)
console.log(`   💾 Memory: ${formatBytes(memAfterNaive.heapUsed - memBeforeNaive.heapUsed)}`)
console.log()

// 3. Simulate Virtual Scroll (สร้างแค่ 30 อัน)
console.log('🟢 Step 3: Simulating Virtual Scroll (only visible rows)...')
const memBeforeVirtual = memoryUsage()
const startVirtual = performance.now()

// จำลอง virtual scroll: render แค่แถวที่มองเห็น
const VISIBLE_COUNT = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + 10 // buffer
const virtualElements = []
const startIndex = 0 // scroll ตำแหน่งบนสุด
const endIndex = Math.min(TOTAL_ROWS, startIndex + VISIBLE_COUNT)

for (let i = startIndex; i < endIndex; i++) {
  virtualElements.push({
    tagName: 'div',
    position: i * ROW_HEIGHT,
    data: mockData[i]
  })
}

const endVirtual = performance.now()
const memAfterVirtual = memoryUsage()

console.log(`   ✅ Created ${virtualElements.length} DOM-like objects`)
console.log(`   ⏱️  Time: ${(endVirtual - startVirtual).toFixed(2)} ms`)
console.log(`   💾 Memory: ${formatBytes(memAfterVirtual.heapUsed - memBeforeVirtual.heapUsed)}`)
console.log()

// 4. Scroll Simulation (ทดสอบว่าอัพเดทเร็วแค่ไหน)
console.log('🔄 Step 4: Simulating 1,000 scroll events...')
const startScroll = performance.now()

for (let scroll = 0; scroll < 1000; scroll++) {
  const scrollTop = Math.floor(Math.random() * TOTAL_ROWS * ROW_HEIGHT)
  const newStart = Math.floor(scrollTop / ROW_HEIGHT)
  const newEnd = Math.min(TOTAL_ROWS, newStart + VISIBLE_COUNT)
  // ใน virtual scroll: แค่ recycle DOM ไม่สร้างใหม่
  const recycled = newEnd - newStart
}

const endScroll = performance.now()

console.log(`   ✅ Processed 1,000 scroll positions`)
console.log(`   ⏱️  Time: ${(endScroll - startScroll).toFixed(2)} ms`)
console.log(`   ⚡ Speed: ${(1000 / ((endScroll - startScroll) / 1000)).toFixed(0)} scrolls/sec`)
console.log()

// 5. Summary
console.log('═'.repeat(60))
console.log('📊 BENCHMARK SUMMARY')
console.log('═'.repeat(60))
console.log()

const naiveTime = (endNaive - startNaive).toFixed(0)
const virtualTime = (endVirtual - startVirtual).toFixed(2)
const naiveMem = memAfterNaive.heapUsed - memBeforeNaive.heapUsed
const virtualMem = memAfterVirtual.heapUsed - memBeforeVirtual.heapUsed

console.log('┌─────────────────────┬──────────────┬──────────────┬──────────────┐')
console.log('│ Metric              │   🔴 Naive   │  🟢 Virtual  │ Improvement  │')
console.log('├─────────────────────┼──────────────┼──────────────┼──────────────┤')
console.log(`│ Render Time (ms)    │ ${naiveTime.padStart(10)}  │ ${virtualTime.padStart(10)}  │   ${(naiveTime / virtualTime).toFixed(0)}x faster  │`)
console.log(`│ Memory (bytes)      │ ${formatBytes(naiveMem).padStart(10)}  │ ${formatBytes(virtualMem).padStart(10)}  │   ${(naiveMem / virtualMem).toFixed(0)}x less    │`)
console.log(`│ Elements Created    │ ${formatNumber(TOTAL_ROWS).padStart(10)}  │     ${virtualElements.length.toString().padStart(6)}  │   ${(TOTAL_ROWS / virtualElements.length).toFixed(0)}x fewer   │`)
console.log('└─────────────────────┴──────────────┴──────────────┴──────────────┘')
console.log()

console.log('💡 Conclusion:')
console.log('   Virtual Scroll + DOM Recycling provides massive performance gains')
console.log(`   - ${(TOTAL_ROWS / virtualElements.length).toFixed(0)}x fewer DOM elements`)
console.log(`   - ~${(naiveTime / virtualTime).toFixed(0)}x faster render time`)
console.log(`   - ~${(naiveMem / virtualMem).toFixed(0)}x less memory usage`)
console.log()
console.log('✅ Benchmark complete!')
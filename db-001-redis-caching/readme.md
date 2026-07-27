# db-001: Distributed Caching & Query Optimization

**Status:** `[COMPLETED]`  
**Category:** Database  
**Tag** Performance Architecture  
**Last Updated:** กรกฎาคม 2026

โปรเจกต์นี้เป็นห้องปฏิบัติการ (Lab) สำหรับวิเคราะห์และเปรียบเทียบประสิทธิภาพของการดึงข้อมูลจากฐานข้อมูลเชิงสัมพันธ์ขนาดใหญ่ (PostgreSQL - 1,000,000 แถว) เปรียบเทียบกับการประยุกต์ใช้ **Distributed Caching (Redis)** เพื่อลดภาระของฐานข้อมูลหลักและเพิ่ม Throughput ให้กับระบบ API

![ss](ss.gif)

## 🎯 วัตถุประสงค์ (Objectives)

1. ✅ วิเคราะห์และระบุคอขวด (Bottleneck) ที่เกิดขึ้นเมื่อแอปพลิเคชันต้องรับ Concurrent Requests ปริมาณมาก
2. ✅ ประยุกต์ใช้รูปแบบการทำแคชแบบ **Cache-Aside Pattern**
3. ✅ จัดการโครงสร้างพื้นฐานด้วย Docker Compose เพื่อแยก Service Isolation
4. ✅ ทำการทดสอบโหลด (Load Testing) เพื่อเปรียบเทียบค่าความหน่วง (Latency) และปริมาณการประมวลผล (Requests per Second)

---

## 🏗️ สถาปัตยกรรมระบบ (System Architecture)

ระบบถูกออกแบบโดยแยกชั้นการประมวลผลออกจากกันอย่างชัดเจน (Separation of Concerns)

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Environment                   │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│  │   API    │    │  Redis   │    │PostgreSQL│           │
│  │ Server   │◄──►│  Cache   │    │   DB     │           │
│  │ :3000    │    │  :6379   │    │  :5433   │           │
│  └──────────users น้อย ไม่จำเป็นต้อง cache

#### Redis Caching

- ✅ **เร็วขึ้น 6-435 เท่า:** ตอบสนองในระดับ millisecond
- ✅ **ลดภาระ Database:** ┘    └──────────┘    └──────────┘           │
│       │               │                │                │
│       └───────────────┴────────────────┘                │
│                     Docker Network                      │
└─────────────────────────────────────────────────────────┘
```

### ชั้นการทำงาน (Layers):

1. **Client / Load Tester:**
   - จำลองผู้ใช้จริงด้วย Autocannon
   - ทดสอบแบบ Concurrent Connections 3-50 connections
   - ระยะเวลาทดสอบ 30 วินาทีต่อรอบ

2. **API Layer (Node.js/Express):**
   - `src/app.js` — Direct Database Query (Baseline) พอร์ต 3000
   - `src/app-cached.js` — Redis Caching Enabled พอร์ต 3001
   - ตัดสินใจเลือกแหล่งข้อมูลตาม Cache-Aside Pattern

3. **Cache Layer (Redis 7):**
   - In-Memory Data Store ความเร็วสูง
   - TTL (Time-to-Live) ตั้งไว้ที่ 1 ชั่วโมง (3600 วินาที)
   - Key Pattern: `sales:monthly:2023:6`, `sales:top-products:2023:6`

4. **Data Layer (PostgreSQL 15):**
   - เก็บข้อมูลถาวร 1,000,000 แถว
   - มี Index บน `transaction_date` เพื่อเพิ่มความเร็วในการค้นหา
   - Connection Pool สูงสุด 20 connections

### Flow การทำงาน (Cache-Aside Pattern):

```text
┌─ Request เข้ามา ─┐
        │
        ▼
┌──────────────┐
│  ตรวจสอบ     │
│  Redis Cache │
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
🟢 HIT    🔴 MISS
   │       │
   │       ▼
   │  ┌──────────┐
   │  │ Query    │
   │  │PostgreSQL│
   │  └────┬─────┘
   │       │
   │       ▼
   │  ┌──────────┐
   │  │ เก็บลง   │
   │  │  Redis   │
   │  └────┬─────┘
   │       │
   └───┬───┘
       │
       ▼
┌──────────────┐
│ ส่งผลลัพธ์   │
│ กลับ Client  │
└──────────────┘
```

---

## 🛠️ เทคโนโลยีที่ใช้งาน (Tech Stack)

| Layer              | Technology         | Version   | Purpose                                        |
| ------------------ | ------------------ | --------- | ---------------------------------------------- |
| **Runtime**        | Node.js            | v20.6+    | JavaScript Runtime พร้อม Native `.env` Support |
| **Framework**      | Express.js         | 4.18.x    | HTTP Server & Routing                          |
| **Database**       | PostgreSQL         | 15-alpine | Persistent Data Storage (1M rows)              |
| **Cache**          | Redis              | 7-alpine  | In-Memory Distributed Cache                    |
| **Infrastructure** | Docker Compose     | v2        | Container Orchestration                        |
| **Load Testing**   | Autocannon         | 7.x       | HTTP Benchmarking Tool                         |
| **Logging**        | Morgan             | 1.10.x    | HTTP Request Logger                            |
| **DB Driver**      | node-postgres (pg) | 8.11.x    | PostgreSQL Client                              |
| **Cache Client**   | node-redis         | 4.6.x     | Redis Client                                   |

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

```
db-001-redis-caching/
├── .env                          # Environment Variables (ไม่ commit เข้า Git)
├── .gitignore                    # Git ignore rules
├── docker-compose.yml            # Docker Services (PostgreSQL + Redis)
├── package.json                  # Node.js Dependencies & Scripts
├── README.md                     # เอกสารโปรเจกต์ (ไฟล์นี้)
├── sales_data_1m.csv             # ข้อมูลจำลอง 1 ล้านแถว (ไม่ commit)
├── benchmark-results/            # ผลการทดสอบ (เก็บเป็น JSON)
│   ├── baseline-results.json
│   └── cached-results.json
└── src/
    ├── app.js                    # API แบบ Direct DB Query (Baseline) → Port 3000
    ├── app-cached.js             # API แบบ Redis Caching → Port 3001
    ├── seed.js                   # สคริปต์นำเข้าข้อมูล 1M rows
    ├── benchmark.js              # ชุดทดสอบสำหรับ Baseline API
    ├── benchmark-cached.js       # ชุดทดสอบสำหรับ Cached API
    └── load-test.js              # เครื่องมือทดสอบเดี่ยว (Single Endpoint)
```

---

## 📊 ผลการทดสอบประสิทธิภาพ (Benchmark Results)

### 🧪 Testing Methodology

```
Tool:         Autocannon 7.x
Duration:     30 seconds per test
Environment:  Docker containers on local machine
Data Volume:  1,000,000 records in PostgreSQL
```

### 📈 Baseline: Direct Database Query (No Cache)

| Endpoint           | Connections | Total Requests | Req/sec      | Avg Latency | P99 Latency | Max Latency |
| ------------------ | ----------- | -------------- | ------------ | ----------- | ----------- | ----------- |
| **Monthly Report** | 10          | 4,072          | 135.74 req/s | 73.06 ms    | 208.00 ms   | 513.00 ms   |
| **Top Products**   | 10          | 4,594          | 153.14 req/s | 65.02 ms    | 179.00 ms   | 371.00 ms   |
| **Range Query**    | 5           | 4,289          | 142.97 req/s | 34.48 ms    | 94.00 ms    | 169.00 ms   |
| **Overall Stats**  | 3           | 363            | 12.10 req/s  | 246.11 ms   | 304.00 ms   | 329.00 ms   |
| **Single Day**     | 20          | 5,900          | 196.67 req/s | 101.15 ms   | 248.00 ms   | 520.00 ms   |

> **🔴 ปัญหาที่พบ:**
>
> - CPU Usage ของ PostgreSQL: **~85-95%** ระหว่างทดสอบ
> - Stats Endpoint ทำได้แค่ **12 req/s** เพราะ Full Table Scan
> - P99 Latency พุ่งสูงกว่า Avg Latency มาก (196ms vs 105ms)
> - Query ที่ซับซ้อนใช้เวลามากถึง **246ms**

### 🟢 Cached: Redis Cache Enabled

| Endpoint           | Connections | Total Requests | Req/sec        | Avg Latency | P99 Latency | Max Latency |
| ------------------ | ----------- | -------------- | -------------- | ----------- | ----------- | ----------- |
| **Monthly Report** | 50          | ~123,582       | 4,119.40 req/s | 11.64 ms    | 30.00 ms    | N/A         |
| **Top Products**   | 50          | ~156,124       | 5,204.14 req/s | 9.04 ms     | 12.00 ms    | N/A         |
| **Range Query**    | 30          | ~149,588       | 4,986.27 req/s | 5.51 ms     | 9.00 ms     | N/A         |
| **Overall Stats**  | 50          | ~158,044       | 5,268.14 req/s | 8.91 ms     | 12.00 ms    | N/A         |

> **🟢 ข้อดีที่ได้:**
>
> - CPU Usage ของ PostgreSQL: **~2-5%** (แทบไม่ถูกใช้งานเลย!)
> - Redis ใช้ Memory เพียง **~2.5 MB** สำหรับ cache ทั้งหมด
> - รองรับ Concurrent Users ได้มากกว่า **50-100 เท่า**
> - P99 Latency ใกล้เคียงกับ Avg Latency มาก (ประสิทธิภาพสม่ำเสมอ)

---

### 🚀 Performance Comparison

| Endpoint           | Metric      | 🔴 Direct DB | 🟢 Redis Cache | Improvement                     |
| ------------------ | ----------- | ------------ | -------------- | ------------------------------- |
| **Monthly Report** | Req/sec     | 135.74       | 4,119.40       | **↑ 2,935% (30x)** 🚀           |
|                    | Avg Latency | 73.06ms      | 11.64ms        | **↓ 84.1% (6x faster)** ⚡      |
|                    | P99 Latency | 208.00ms     | 30.00ms        | **↓ 85.6%** ⚡                  |
| **Top Products**   | Req/sec     | 153.14       | 5,204.14       | **↑ 3,298% (34x)** 🚀           |
|                    | Avg Latency | 65.02ms      | 9.04ms         | **↓ 86.1% (7x faster)** ⚡      |
|                    | P99 Latency | 179.00ms     | 12.00ms        | **↓ 93.3%** ⚡                  |
| **Range Query**    | Req/sec     | 142.97       | 4,986.27       | **↑ 3,387% (35x)** 🚀           |
|                    | Avg Latency | 34.48ms      | 5.51ms         | **↓ 84.0% (6x faster)** ⚡      |
|                    | P99 Latency | 94.00ms      | 9.00ms         | **↓ 90.4%** ⚡                  |
| **Overall Stats**  | Req/sec     | 12.10        | 5,268.14       | **↑ 43,439% (435x)** 🚀🚀🚀     |
|                    | Avg Latency | 246.11ms     | 8.91ms         | **↓ 96.4% (28x faster)** ⚡⚡⚡ |
|                    | P99 Latency | 304.00ms     | 12.00ms        | **↓ 96.1%** ⚡⚡⚡              |

### 📈 สรุปโดยรวม

| Metric           | 🔴 Direct DB (Avg) | 🟢 Redis Cache (Avg) | Improvement                 |
| ---------------- | ------------------ | -------------------- | --------------------------- |
| **Requests/sec** | 128.1 req/s        | 4,894.5 req/s        | **↑ 3,720% (38x)** 🚀       |
| **Avg Latency**  | 104.0 ms           | 8.8 ms               | **↓ 91.5% (12x faster)** ⚡ |
| **P99 Latency**  | 196.3 ms           | 15.8 ms              | **↓ 92.0%** ⚡              |

---

## 📊 การเปรียบเทียบแบบละเอียด (Detailed Comparison)

### 1️⃣ ด้านประสิทธิภาพ (Performance)

| ปัจจัย             | Direct DB Query             | Redis Caching            |
| ------------------ | --------------------------- | ------------------------ |
| **Response Time**  | 34-246ms                    | 5-12ms                   |
| **Throughput**     | 12-197 req/s                | 4,119-5,268 req/s        |
| **Resource Usage** | CPU Intensive (DB)          | Memory Intensive (Redis) |
| **Scalability**    | ถูกจำกัดด้วย DB connections | Scale ได้เกือบไม่จำกัด   |
| **เหมาะสำหรับ**    | ข้อมูลเปลี่ยนแปลงบ่อย       | ข้อมูลอ่านบ่อย เขียนน้อย |

### 2️⃣ ข้อดี (Advantages)

#### Direct DB Query

- ✅ **ข้อมูลสดเสมอ (Real-time Data):** ไม่มีปัญหา stale data
- ✅ **ความเรียบง่าย (Simplicity):** ไม่ต้องจัดการ cache invalidation
- ✅ **ใช้ทรัพยากรน้อยกว่า:** ไม่ต้องมี Redis server แยก
- ✅ **เหมาะกับระบบเล็ก:** ถ้า users น้อย ไม่จำเป็นต้อง cache

#### Redis Caching

- ✅ **เร็วขึ้น 6-435 เท่า:** ตอบสนองในระดับ millisecond
- ✅ **ลดภาระ Database:** DB ทำงานน้อยลง 90%+
- ✅ **รองรับผู้ใช้มหาศาล:** จาก ~50 → 5,000+ concurrent users
- ✅ **ประหยัดค่าใช้จ่าย DB:** ลดการ scale database แนวตั้ง (vertical)
- ✅ **Cache Reusability:** ข้อมูลหนึ่งสามารถให้บริการผู้ใช้ได้หลายคน
- ✅ **ประสิทธิภาพสม่ำเสมอ:** P99 latency ใกล้เคียงกับ Average มาก

### 3️⃣ ข้อเสีย (Disadvantages)

#### Direct DB Query

- ❌ **ช้าเมื่อข้อมูลใหญ่:** 1M rows ใช้เวลา 246ms สำหรับ Stats
- ❌ **ไม่รองรับ High Traffic:** พังเมื่อมี concurrent users มาก
- ❌ **เปลือง Database Resources:** ทุก query ต้องประมวลผลใหม่
- ❌ **ไม่เหมาะกับ Read-Heavy Workload:** เช่น dashboard, reports

#### Redis Caching

- ❌ **ข้อมูลอาจเก่า (Stale Data):** ต้องจัดการ cache invalidation
- ❌ **ความซับซ้อนเพิ่มขึ้น:** ต้องเขียน logic จัดการ cache
- ❌ **Memory Usage:** ต้องมี RAM เพียงพอสำหรับ cache
- ❌ **Single Point of Failure:** ถ้า Redis พัง (แต่แก้ได้ด้วย Redis Cluster)
- ❌ **Cache Miss Penalty:** ครั้งแรกที่ query จะช้าเหมือนไม่มี cache

### 4️⃣ เมื่อไหร่ควรใช้ (Use Cases)

#### ใช้ Direct DB Query เมื่อ:

- 📊 ระบบมีผู้ใช้น้อย (< 50 concurrent)
- 🔄 ข้อมูลเปลี่ยนแปลงตลอดเวลา (Real-time trading)
- 💰 งบประมาณจำกัด ไม่อยากเพิ่ม infrastructure
- 🚀 กำลังพัฒนา MVP หรือ Prototype

#### ใช้ Redis Caching เมื่อ:

- 👥 รองรับผู้ใช้จำนวนมาก (> 100 concurrent)
- 📖 ระบบอ่านข้อมูลบ่อยกว่าการเขียน (Read > Write 90%+)
- 📈 มีรายงานหรือ Dashboard ที่ query ซ้ำๆ
- ⚡ ต้องการ response time < 100ms
- 💸 พร้อมลงทุน infrastructure เพิ่มเพื่อประสิทธิภาพ

---

## 🛡️ กลยุทธ์การลบล้างแคช (Cache Invalidation Strategy)

> _"There are only two hard things in Computer Science: cache invalidation and naming things."_  
> — Phil Karlton

### กลยุทธ์ที่ใช้ในโปรเจกต์นี้:

1. **Time-to-Live (TTL) — ใช้หลัก**
   - กำหนดอายุ cache 1 ชั่วโมง (3600 วินาที)
   - เหมาะกับข้อมูลรายงานที่ไม่เปลี่ยนบ่อย
   - ข้อดี: เรียบง่าย ไม่ต้องจัดการอะไร
   - ข้อเสีย: ข้อมูลอาจเก่าได้ 1 ชั่วโมง

2. **Manual Invalidation — ใช้เสริม**
   - API Endpoint: `POST /api/cache/invalidate`
   - ใช้เมื่อมีการอัปเดตข้อมูลฉุกเฉิน
   - รองรับทั้งลบเฉพาะ key หรือทั้งหมด

   ```bash
   # ลบ cache ทั้งหมด
   curl -X POST http://localhost:3001/api/cache/invalidate \
     -H "Content-Type: application/json" \
     -d '{}'

   # ลบเฉพาะ monthly report
   curl -X POST http://localhost:3001/api/cache/invalidate \
     -H "Content-Type: application/json" \
     -d '{"key": "monthly:2023:6"}'
   ```

3. **Cache Warming — เสริม**
   - อุ่น cache ล่วงหน้าสำหรับข้อมูลที่ใช้บ่อย
   - ลด cache miss ในช่วงแรก

---

## 🚦 คู่มือการติดตั้งและทดสอบ (Getting Started)

### 📋 ความต้องการของระบบ (Prerequisites)

```bash
✓ Docker & Docker Compose v2+
✓ Node.js v20.6.0 ขึ้นไป (รองรับ --env-file)
✓ npm v9+
✓ Git (สำหรับ Clone Repository)
```

### 🔧 Step 1: Clone & Setup Environment

```bash
# 1. Clone repository
git clone https://github.com/weerayosong/the-lab.git
cd the-lab/db-001-redis-caching

# 2. สร้างไฟล์ .env
cat > .env << EOF
PGUSER=admin
PGPASSWORD=password123
PGHOST=localhost
PGPORT=5433
PGDATABASE=sales_db

REDIS_HOST=localhost
REDIS_PORT=6379
EOF
```

### 🐳 Step 2: Start Infrastructure

```bash
# Start PostgreSQL & Redis containers
docker compose up -d

# ตรวจสอบว่า containers ทำงานอยู่
docker compose ps
```

### 📊 Step 3: Seed Data (1,000,000 Records)

```bash
npm install
npm run seed
```

### 🚀 Step 4: Start API Servers & Run Benchmarks

```bash
# Terminal 1: Baseline API
npm start

# Terminal 2: Run Baseline Benchmark
npm run benchmark

# หยุด Baseline API แล้วเริ่ม Cached API
npm run start:cached

# Terminal 2: Run Cached Benchmark
npm run benchmark:cached
```

---

## 📚 บทเรียนที่ได้รับ (Lessons Learned)

### 1. **Database Bottleneck เป็นเรื่องจริง**

- Stats Query ทำได้แค่ 12 req/s บน 1M rows
- P99 Latency พุ่งสูงกว่า Average 2-3 เท่า แสดงถึงความไม่สม่ำเสมอ

### 2. **Cache คืออาวุธที่ทรงพลังที่สุด**

- Redis เปลี่ยน Stats จาก 12 req/s → 5,268 req/s (435 เท่า!)
- แม้แต่ Query ที่เร็วอยู่แล้วก็ยังเร็วขึ้นอีก 30-35 เท่า

### 3. **Docker Compose ทำให้ชีวิตง่ายขึ้น**

- แยก services ชัดเจน: DB, Cache, API
- ทำลายและสร้างใหม่ได้ในไม่กี่วินาที

### 4. **Monitoring คือหัวใจ**

- ถ้าไม่วัด performance จะไม่รู้ว่าช้าตรงไหน
- Autocannon ทำให้เห็นภาพชัดเจน: latency, throughput, errors

### 5. **อย่า Optimize โดยไม่วัดก่อน**

- ต้องมี Baseline ก่อนถึงจะรู้ว่า caching ช่วยได้แค่ไหน
- ตัวเลข 43,439% improvement จะเกิดขึ้นไม่ได้ถ้าไม่วัด

---

## 🌟 สรุปความเข้าใจอย่างง่าย (ELI5 — Explain Like I'm 5)

### 🎯 สำหรับคนที่ไม่ใช่สายเทค

ลองนึกภาพว่าคุณเป็น **บรรณารักษ์** ในห้องสมุดขนาดใหญ่ที่มีหนังสือ **1 ล้านเล่ม** 📚

#### 🔴 วิธีแรก: ไม่มี Cache (Direct Database)

ทุกครั้งที่มีคนมาถามหา _"ยอดการยืมเดือนมิถุนายน"_ คุณต้อง:

1. เดินไปที่ชั้นหนังสือ
2. หยิบหนังสือทีละเล่ม
3. เปิดดูว่าใช่เดือนมิถุนายนไหม
4. จดตัวเลขใส่กระดาษ
5. คำนวณรวมทั้งหมด

⏱️ **ใช้เวลา 3-5 นาที** ทุกครั้งที่มีคนถาม!

❌ **ปัญหา:**

- ถ้ามีคนถามพร้อมกัน 20 คน คุณจะวุ่นวายมาก
- ต้องเดินทั้งวัน ไม่ได้พักเลย
- หนังสือเริ่มเก่าเพราะหยิบเข้าออกบ่อย

---

#### 🟢 วิธีที่สอง: มี Cache (Redis)

คุณจะเริ่ดขึ้น!😏 คุณเอากระดาษโน้ตมาติดไว้ที่โต๊ะ 📝

เมื่อมีคนถาม _"ยอดการยืมเดือนมิถุนายน"_

1. **ครั้งแรก:** คุณยังต้องเดินไปนับหนังสืออยู่ (3-5 นาที)
2. **แต่!** พอคุณคำนวณเสร็จ คุณเขียนคำตอบไว้บนกระดาษโน้ต
3. **ครั้งต่อไป:** มีคนถามเหมือนเดิม คุณแค่มองกระดาษโน้ตที่โต๊ะ!

⏱️ **ใช้เวลา 0.01 วินาที** (แค่มองกระดาษ)! เร็วกว่า **3,000-30,000 เท่า**! 🚀

✅ **ข้อดี:**

- รองรับคนถามพร้อมกันได้เป็นร้อยเป็นพัน
- หนังสือในห้องสมุดแทบไม่ต้องยุ่งเลย
- คุณนั่งชิลๆ ที่โต๊ะ มองกระดาษโน้ตอย่างเดียว

⚠️ **ข้อเสีย:**

- ถ้ามีคนเอาหนังสือเล่มใหม่มาเพิ่ม คุณต้องเปลี่ยนกระดาษโน้ต
- ต้องมีสมุดโน้ตไว้ใกล้ๆ (ใช้พื้นที่โต๊ะนิดหน่อย แรมใช้เพิ่มจาก6.3เป็น6.9 = 300MB)
- ถ้ากระดาษโน้ตหาย ต้องเดินไปนับใหม่ (แต่เกิดขึ้นน้อยมาก)

---

### 📊 ตารางเปรียบเทียบแบบง่าย

| สถานการณ์        | ไม่มี Cache            | มี Cache | ต่างกัน                     |
| ---------------- | ---------------------- | -------- | --------------------------- |
| **คนถาม 1 คน**   | 3-5 นาที               | 0.01 วิ  | เร็วขึ้น 18,000-30,000 เท่า |
| **คนถาม 10 คน**  | 30-50 นาที (ทำไม่ทัน!) | 0.1 วิ   | รับไหวสบายๆ                 |
| **คนถาม 100 คน** | ❌ ระบบล่ม             | 1 วิ     | ❌→✅                       |
| **ความเหนื่อย**  | 😫 เหนื่อยมาก          | 😎 ชิลๆ  | ทำงานน้อยลง 95%             |

---

### 💡 ข้อคิดสำคัญ

> **"Cache ก็เหมือนกระดาษโน้ตบนโต๊ะทำงาน — ถ้าไม่มีมัน คุณต้องลุกเดินไปหาข้อมูลทุกครั้ง แต่ถ้ามีมัน คุณแค่มองที่โต๊ะก็ได้คำตอบ"**

**หลักการจำง่ายๆ:**

1. 📖 **ข้อมูลที่ไม่เปลี่ยนบ่อย** → ควร cache (จดไว้บนกระดาษโน้ต)
2. 📝 **ข้อมูลที่เปลี่ยนตลอดเวลา** → ไม่ควร cache (ต้องเดินไปดูหนังสือทุกครั้ง)
3. ⏰ **ตั้งเวลาหมดอายุ** → กระดาษโน้ตเก่าเกิน 1 ชม. ต้องฉีกทิ้ง แล้วไปจดใหม่
4. 📊 **วัดผลก่อน-หลัง** → ต้องรู้ว่าเร็วขึ้นจริงไหม

---

## 🔜 ขั้นตอนต่อไป (Next Steps)

- [ ] เพิ่ม Redis Sentinel/Cluster สำหรับ High Availability
- [ ] ทดสอบแบบ Distributed Load Testing (หลายเครื่องยิงพร้อมกัน)
- [ ] Implement Cache Stampede Protection
- [ ] เพิ่ม Database Indexing Optimization
- [ ] ทดสอบกับข้อมูล 10M, 100M rows
- [ ] สร้าง Grafana Dashboard สำหรับ Monitoring
- [ ] เขียน CI/CD Pipeline สำหรับ Automated Testing

---

## 🤝 Contributing

โปรเจกต์นี้เป็นส่วนหนึ่งของ **The Lab** Repository  
หากต้องการเสนอแนะหรือปรับปรุง สามารถเปิด Issue หรือ Pull Request ได้ที่:

🔗 [https://github.com/weerayosong/the-lab](https://github.com/weerayosong/the-lab)

---

## 📝 License

MIT License — ใช้เพื่อการศึกษาและพัฒนาได้อย่างอิสระ

---

<p align="center">
  <b>Built with ❤️ for learning and sharing knowledge</b><br>
  <i>"The best way to learn is to build, measure, and optimize."</i>
</p>

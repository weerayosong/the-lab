# db-001: Distributed Caching & Query Optimization

**Status:** `[IN PROGRESS]`  
**Category:** Database & Performance Architecture

โปรเจกต์นี้เป็นห้องปฏิบัติการ (Lab) สำหรับวิเคราะห์และเปรียบเทียบประสิทธิภาพของการดึงข้อมูลจากฐานข้อมูลเชิงสัมพันธ์ขนาดใหญ่ (PostgreSQL - 1,000,000 แถว) เปรียบเทียบกับการประยุกต์ใช้ **Distributed Caching (Redis)** เพื่อลดภาระของฐานข้อมูลหลักและเพิ่ม Throughput ให้กับระบบ API

## วัตถุประสงค์ (Objectives)

1. วิเคราะห์และระบุคอขวด (Bottleneck) ที่เกิดขึ้นเมื่อแอปพลิเคชันต้องรับ Concurrent Requests ปริมาณมาก
2. ประยุกต์ใช้รูปแบบการทำแคชแบบ **Cache-Aside Pattern**
3. จัดการโครงสร้างพื้นฐานด้วย Docker Compose เพื่อแยก Service Isolation
4. ทำการทดสอบโหลด (Load Testing) เพื่อเปรียบเทียบค่าความหน่วง (Latency) และปริมาณการประมวลผล (Requests per Second)

## สถาปัตยกรรมระบบ (System Architecture)

ระบบถูกออกแบบโดยแยกชั้นการประมวลผลออกจากกันอย่างชัดเจน (Separation of Concerns)

1. **Client / Load Tester:** จำลองการส่งคำขอพร้อมกันเข้ามายัง API
2. **API Layer (Node.js/Express):** รับคำขอและตัดสินใจว่าจะดึงข้อมูลจากแหล่งใด
3. **Cache Layer (Redis):** ทำหน้าที่เป็น In-memory Data Store คอยเสิร์ฟข้อมูลที่มีการเรียกใช้บ่อย
4. **Data Layer (PostgreSQL):** แหล่งเก็บข้อมูลหลักแบบ Persistent Store

**Flow การทำงาน (Cache-Aside Pattern):**

```text
Client ➡️ [GET /api/sales] ➡️ Node.js
                               ┣ 🟢 (Cache Hit): อ่านจาก Redis ➡️ ส่งกลับ Client
                               ┗ 🔴 (Cache Miss): อ่านจาก PostgreSQL ➡️ เขียนลง Redis ➡️ ส่งกลับ Client
```

## เทคโนโลยีที่ใช้งาน (Tech Stack)

- **Runtime & Framework:** Node.js (v20.6+), Express.js
- **Database:** PostgreSQL 15 (Alpine)
- **In-Memory Store:** Redis 7 (Alpine)
- **Infrastructure:** Docker Compose (v2)
- **Testing Tool:** Autocannon / Artillery _(Pending)_

ติดตั้ง Dependencies และรันสคริปต์เพื่อนำเข้าข้อมูลจำลองจำนวน 1,000,000 แถวลงใน PostgreSQL (สคริปต์มีการใช้ Batch Processing เพื่อป้องกัน Memory Overload)

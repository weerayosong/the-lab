# fe-004: Virtual Scroll & DOM Recycling

**Status:** [IN PROGRESS]  
**Category:** Frontend
**Tags:** `Performance` `DOM` `Optimization` `Virtualization`  
**Last Updated:** สิงหาคม 2026

## 📋 Concept หลัก

สร้างตารางแสดงข้อมูลขนาดใหญ่ (100,000 แถว) โดยเปรียบเทียบระหว่าง:

### Direct DOM Rendering — สร้าง DOM elements ทั้งหมด → ช้า

### Virtual Scrolling + DOM Recycling — แสดงเฉพาะแถวที่อยู่ใน viewport → เร็ว

---

## 🎯 Use Cases ในงานจริง

### 1. **Dashboard / Data Grid**

- ตารางรายการสินค้า 50,000+ รายการ
- รายการ Transactions ของธนาคาร
- Admin Panel จัดการผู้ใช้หลักแสน

### 2. **Infinite Feed**

- Facebook Timeline, Twitter Feed
- ระบบ Chat ดึงข้อความย้อนหลัง (Slack, Discord)
- รายการ Notification ย้อนหลัง

### 3. **Log Viewer / Monitoring**

- Kibana, Grafana Log Viewer
- Terminal Emulator ที่มี output เป็นแสนบรรทัด

### 4. **E-commerce**

- หน้ารายการสินค้า (Shopee, Lazada) โหลดทีละ 20 ชิ้น แต่ DOM มีแค่ 30 อันพอ
- Filter สินค้าแบบ Infinite Scroll

### 5. **Large Forms / Spreadsheet**

- Google Sheets แสดง 100,000 แถว
- ตาราง Excel-like บนเว็บ

---

## 💼 Ref

- **React Virtualized** / **React Window** → ใช้ใน Netflix, Airbnb
- **AG Grid** → ตารางระดับ Enterprise
- **TanStack Virtual** → Library ใหม่จาก TanStack

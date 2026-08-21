# core-006: Daily Log Service

## Test command (bash)
`pytest tests/ -v`

### ทดสอบเพิ่ม entry:

```bash
python cli.py add -c learning -d 2026-08-21 -m focused "สร้าง CLI สำหรับ Daily Log"
python cli.py add -c learning -d 2026-08-21 -m focused "ทดลองฝึกสอน Python Basic"
python cli.py add -c learning -d 2026-08-21 -m focused "สร้างโปรเจคต์จาก JavaScript"
```

### ทดสอบ list entries:

```bash
python cli.py list
```

### ทดสอบ list พร้อม summary:

```bash
python cli.py list -s
```

### ทดสอบ filter ตามวันที่:

```bash
python cli.py list -d 2026-08-21
```

### ทดสอบ show entry เดี่ยว:

```bash
# แทน <id> ด้วย id จริงจากคำสั่ง list
python cli.py show <id>
```

### ทดสอบ delete:

```bash
# แทน <id> ด้วย id จริง
python cli.py delete <id>
```

### ทดสอบ error case:

```bash
# ควรแสดง error สวยงาม
python cli.py add -c invalid -d "test"
python cli.py add -c work -d ""
```

---

## 🎮 ลองใช้งานจริง

```bash
# เพิ่มหลาย ๆ entries
python cli.py add -c work -d -m neutral "ประชุมทีม 10:00"
python cli.py add -c learning -d -m focused  "อ่านหนังสือ architecture"
python cli.py add -c personal -d -m excited  "ออกกำลังกาย 30 นาที"

# ดูทั้งหมด
python cli.py list

# ดู summary
python cli.py list -s
```


# core-002: Closure Memory Leak Detective

## Overview

Closure ใน JavaScript กัก reference ของ outer scope ทั้งหมด
แม้จะใช้แค่บางส่วน ทำให้ GC ไม่สามารถเก็บ object ใหญ่ๆ ได้
→ heap ค่อยๆ โตจน Single Page App crash หลังจากเปิด tab นานๆ

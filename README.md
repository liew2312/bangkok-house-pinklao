# Handoff: ระบบบริหารจัดการหอพัก (Dormitory Manager)

## Overview
เว็บแอปฝั่งผู้ดูแล/เจ้าของหอ สำหรับหอพักขนาดกลาง (30–100 ห้อง) ครอบคลุม 7 ส่วน:
แดชบอร์ด, ห้องพัก, ผู้เช่า/สัญญา, จดมิเตอร์+ออกบิล, เก็บเงิน/ตรวจสลิป, รายงานการเงิน, แจ้งซ่อม
งานหลักที่ระบบต้องช่วยให้เร็วที่สุด: **ตามเก็บเงิน** และ **จดมิเตอร์**

## About the Design Files
ไฟล์ในชุดนี้เป็น **design reference ที่ทำด้วย HTML** (โปรโตไทป์แสดงหน้าตา + พฤติกรรมที่ตั้งใจ) ไม่ใช่โค้ดโปรดักชันที่ก็อปไปใช้ตรงๆ
งานของนักพัฒนาคือ **สร้างดีไซน์นี้ขึ้นใหม่ใน codebase จริง** (React / Vue / ฯลฯ) ตาม pattern และ component library ที่มีอยู่ — หรือถ้ายังไม่มี ให้เลือก framework ที่เหมาะกับโปรเจกต์แล้ว implement ตามนี้
ไฟล์ต้นฉบับเป็น "Design Component" ตัวเดียว (`.dc.html`) โครงคือ template + logic class (state/handlers) แบบ React-like — อ่านเป็นสเปกเชิงพฤติกรรมได้เลย

## Fidelity
**High-fidelity (hifi)** — สี ตัวอักษร ระยะ และ interaction เป็นค่าจริง ให้ recreate UI ให้ตรง โดยใช้ library/pattern ของ codebase เอง

## Design System — NomadKit
ธีมสีอ้างจาก NomadKit (warm sand + ocean/forest accents). โทเคนที่ใช้จริง:

### Colors
| Role | Hex | หมายเหตุ |
|---|---|---|
| Primary Sand | `#D4A373` | ปุ่ม/เมนู active — **ใช้ตัวอักษรเข้ม `#1C1917` บนพื้นทราย** (คอนทราสต์พอ) |
| Sand hover | `#9A6A38` | hover ของ primary |
| Sand tints | 50 `#FBF5EC` · 100 `#F7ECDD` · 200 `#F0DDC9` · 400 `#E3C09B` | พื้นอ่อน/แท่งกราฟรอง |
| Ocean (info/links) | `#0891B2` (hover `#0E7490`) | ลิงก์, ค่าน้ำ, ไอคอนงานซ่อม |
| Forest (success) | `#166534` bg `#E3F0E7` | ชำระแล้ว, อัตราเข้าพัก, ปิดงาน |
| Warning | `#CA8A04` bg `#FBF3DC` | จดมิเตอร์ค้าง, รอตรวจสลิป |
| Error/Danger | `#DC2626` bg `#FBE7E7` | ค้างชำระ, badge ด่วน |
| Canvas | `#FFFDF7` | พื้นหลังหน้า (นวลอุ่น) |
| Surface | `#FFFFFF` | การ์ด |
| Sunken | `#F6F0E4` | พื้นจม, header ตาราง |
| Ink text | 900 `#1C1917` · 800 `#292524` · fg-2 `#57534E` · fg-3 `#78716C` · fg-4 `#A8A29E` | |
| Border | subtle `#E9E0CF` · default `#CFC3A6` | |

**Do/Don't (NomadKit):** ใช้ Sand เป็นสี action หลัก · อย่าสื่อความหมายด้วยสีอย่างเดียว (มี label/ไอคอนกำกับเสมอ) · ออกแบบเผื่อ offline + skeleton state

### Typography
- Family: `"AP", "Noto Sans Thai", system-ui, sans-serif` (โปรเจกต์จริงใช้ฟอนต์ของระบบตัวเองได้ ขอให้รองรับไทย+ละติน)
- Weight เป็นแกนลำดับชั้น: 400 / 500 / 600 / 700
- ตัวอย่างขนาด: page title 22px/700 · KPI number 30px/700 · card heading 16px/700 · body 13–14px/400–600 · caption 11–12px · eyebrow 11px/700 uppercase tracking .08em

### Spacing / Shape / Elevation
- Base rhythm 4px; gutter ที่ใช้บ่อย 16px; padding การ์ด 18–24px
- Radius: การ์ด 16px · การ์ดย่อย/ปุ่มในตาราง 8–12px · ปุ่ม/ชิป/แท็บ pill 999px · แท่งกราฟ 5–6px บน
- Shadow (warm-tinted): sm `0 2px 4px rgba(20,14,14,.06)` · md `0 6px 16px rgba(20,14,14,.08)` · xl สำหรับ drawer/modal
- Motion: 120–200ms, ease `cubic-bezier(0.2,0,0,1)`; fade + translate เล็กน้อย; card hover `translateY(-3px)` + shadow

## Layout (Shell)
- Grid: `grid-template-columns: 248px 1fr; height: 100vh`
- **Sidebar (248px)**: โลโก้ (สามเหลี่ยมทรายซ้อน 3 ชั้น hard-edge), เมนู 7 รายการ (มี badge นับงานค้าง), การ์ดรอบบิลปัจจุบันด้านล่าง
- **Main**: topbar sticky (eyebrow+title ซ้าย, search, โปรไฟล์) + พื้นที่ scroll เนื้อหา
- Nav active = พื้น Sand + ตัวอักษรเข้ม; inactive = โปร่ง hover ghost

## Screens / Views

### 1. แดชบอร์ด (Dashboard) — มี 2 เลย์เอาต์ สลับด้วยแท็บ
KPI strip ร่วม 4 การ์ด: อัตราเข้าพัก%, เก็บได้เดือนนี้, ค้างชำระ, จดมิเตอร์ค้าง (แต่ละใบมี dot สีสถานะ + delta)
- **A · การเงิน/ภาพรวม**: กราฟแท่งรายรับ 6 เดือน + โดนัทอัตราเข้าพัก (conic-gradient forest/neutral/warning) + รายการ "ต้องตามเก็บ" (ปุ่มทวงถาม) + ฟีดความเคลื่อนไหว
- **B · โฟกัสงานวันนี้**: 3 คอลัมน์งานค้าง (จดมิเตอร์ / ตามเก็บเงิน / งานซ่อม) แต่ละแถวมีปุ่ม action; คอลัมน์ว่างขึ้นสถานะ "ไม่มีงานค้าง"

### 2. ห้องพัก (Rooms)
ฟิลเตอร์ชิป (ทั้งหมด/เข้าพัก/ว่าง/ปรับปรุง พร้อมจำนวน) → กริดห้องแยกตามชั้น (8 คอลัมน์/ชั้น, 6 ชั้น = 48 ห้อง) การ์ดห้องมี dot สถานะมุมขวาบน, เลขห้อง, ชื่อผู้เช่า/สถานะ; hover ยกตัว; คลิกเปิด **drawer** รายละเอียดห้อง

### 3. ผู้เช่า / สัญญา (Tenants)
ตาราง (grid 6 คอลัมน์): ห้อง · ผู้เช่า(avatar+ชื่อ) · เบอร์ · เข้าอยู่เมื่อ · ค่าเช่า/เดือน · สถานะบิล(ชิป) คลิกแถวเปิด drawer เดียวกับ Rooms

### 4. จดมิเตอร์ & ออกบิล (Billing) — งานหลัก
การ์ดสรุป "ยังไม่จดมิเตอร์ N ห้อง" + ข้อความอัตราค่าน้ำ/ไฟ + แท็บ (ค้างจด/ทั้งหมด)
ตารางกรอกเลข: ห้อง · ผู้เช่า · น้ำ(ก่อน→**input**) · ไฟ(ก่อน→**input**) · หน่วยที่คำนวณ · รวมบิล · ปุ่ม "สร้างบิล"
- พิมพ์เลขปัจจุบัน → คำนวณหน่วย/ยอดสด; ปุ่มสร้างบิล enable เมื่อ current > prev ทั้งสองค่า; กดแล้วเปลี่ยนสถานะเป็น "ค้างชำระ" + toast

### 5. เก็บเงิน / ตรวจสลิป (Payments) — งานหลัก
3 การ์ดสรุป (เก็บแล้ว/รอตรวจสลิป/ค้างชำระ) + ฟิลเตอร์ + รายการบิล แต่ละแถว: ห้อง, ผู้เช่า, breakdown, ยอดรวม, ชิปสถานะ, ปุ่ม action ตามสถานะ:
- **ค้างชำระ** → ทวงถาม(toast) / รับเงินสด(→ชำระแล้ว)
- **รอตรวจสลิป** → ดู&ยืนยันสลิป (เปิด **modal** สลิป → ยืนยัน=ชำระแล้ว / ปฏิเสธ=กลับไปค้าง)
- **ชำระแล้ว** → ออกใบเสร็จ(toast)

### 6. รายงานการเงิน (Reports)
4 stat การ์ด + กราฟแท่งคู่ (เก็บได้จริง Sand vs ค้างชำระ neutral) รายเดือน + โดนัทสัดส่วนรายได้ (ค่าเช่า/น้ำ/ไฟ) พร้อม legend

### 7. แจ้งซ่อม (Maintenance) — kanban 3 คอลัมน์
รอรับเรื่อง / กำลังดำเนินการ / เสร็จสิ้น การ์ดงานมี ห้อง, ป้ายความสำคัญ (ด่วน=แดง), หัวข้อ, meta; ปุ่มเลื่อนสถานะ (เริ่มดำเนินการ → ปิดงาน / เปิดใหม่)

## Interactions & Behavior
- นำทางเปลี่ยนหน้าใน sidebar; badge นับงานค้างอัปเดตตาม state จริง
- Drawer ห้อง: slide-in จากขวา (400px), overlay คลิกพื้นหลังปิด, occupied=หัวสีทราย(ตัวอักษรเข้ม) แสดงผู้เช่า+บิล+ปุ่มส่งใบแจ้งหนี้/โทร; vacant=หัวเข้ม + ปุ่มประกาศห้องว่าง
- Modal สลิป: pop-in, กล่องสลิป placeholder + ปุ่มยืนยัน(forest)/ปฏิเสธ
- Toast: กลางล่าง, ink เข้ม, auto-hide ~2.8s ทุก action สำเร็จ
- Hover: การ์ดห้องยกตัว, ปุ่ม/แถวเปลี่ยนพื้น; transition 120–200ms
- Validation จดมิเตอร์: ปุ่มสร้างบิล disable จนกว่ากรอกครบและค่ามากกว่าเลขก่อนหน้า

## State Management
- `page` (หน้า active), `dashLayout` (a|b)
- `rooms[]`: `{id, floor, no, type, rent, status: occupied|vacant|maintenance, tenant{name,phone,moveIn,deposit}, meter{prevW,prevE,currW,currE}, billStatus: unread|unpaid|pending|paid, slip, paidDate, overdueDays}`
- `maintenance[]`: `{id, room, title, category, reporter, date, prio, status: new|inprogress|done}`
- UI state: `roomFilter, payFilter, meterFilter, drawer(roomId), slip(roomId), toast`
- Derived (คำนวณจาก rooms): occupancy%, รายรับที่เก็บได้/รอตรวจ/ค้าง, จำนวนมิเตอร์ค้าง, collection rate, สัดส่วนรายได้
- สูตรบิล: `total = rent + (currW-prevW)*waterRate + (currE-prevE)*elecRate` (ดีฟอลต์ น้ำ 18, ไฟ 8 บาท/หน่วย — ควรเป็นค่าตั้งค่าได้)

## Tweakable settings (config)
- `defaultDashboard`: a | b
- `waterRate`: 10–30 บาท/หน่วย (ดีฟอลต์ 18)
- `elecRate`: 5–15 บาท/หน่วย (ดีฟอลต์ 8)

## Assets
- ไม่มีรูปจริง — โลโก้เป็น CSS 3 บล็อกซ้อน (hard-edge), ไอคอนเป็น inline SVG สไตล์ Lucide (stroke 1.75). ในโปรดักชันใช้ icon library ของ codebase (แนะนำ Lucide) และใส่โลโก้/รูปจริงแทน placeholder
- สลิปในหน้า Payments เป็น placeholder — ต่อกับรูปสลิปที่ผู้เช่าอัปโหลดจริง

## Notes สำหรับ implementation
- ข้อมูลทั้งหมดเป็น mock (seeded) — ต่อ API/DB จริง: rooms, tenants, leases, meter readings, bills, payments, maintenance
- แนะนำ: การจดมิเตอร์ควร autosave draft (offline-first), การตรวจสลิปอาจต่อ OCR ตรวจยอด/ธนาคารอัตโนมัติ
- รองรับ responsive: ตอนนี้ออกแบบ desktop-first; มือถือควรยุบ sidebar เป็น bottom nav / drawer และตารางเป็นการ์ด

## Files
- `ระบบบริหารหอพัก.dc.html` — โปรโตไทป์เต็ม (template + logic) ใช้อ้างอิงสเปกได้ทั้งหมด

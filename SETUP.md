# ติดตั้ง / อัปเดตระบบ (หน้าเว็บบน GitHub Pages + ฐานข้อมูล Google Sheet เดิม)

```
หน้าเว็บ (GitHub Pages: โฟลเดอร์ docs/)  ──fetch──▶  Apps Script (Code.js = API)  ──▶  Google Sheet เดิม
```

- **หน้าเว็บ** = `docs/index.html` + `docs/config.js` → GitHub Pages เผยแพร่ให้อัตโนมัติเมื่อ push
- **API** = `Code.js` บน Apps Script (ผูกกับ Google Sheet เดิม) — ไม่ส่งหน้าเว็บแล้ว รับเฉพาะคำสั่งที่ล็อกอินแล้ว + LINE webhook
- **ล็อกอิน** ตรวจที่ server ใช้ชื่อผู้ใช้/รหัสผ่านจากแท็บ Settings (`AdminUser` / `AdminPass`) ได้ token อายุ 30 วัน
- ข้อมูลลับ (รหัสแอดมิน, LINE token) ไม่ถูกส่งไปที่หน้าเว็บเลย

---

## ครั้งแรก (ทำครั้งเดียว)

### 1. อัปเดต Apps Script (API)
- วิธี A (clasp): `clasp push` (ส่งเฉพาะ `Code.js` + `appsscript.json`)
- วิธี B (คัดลอกเอง): เปิด Apps Script ของ Google Sheet → วางเนื้อหา `Code.js` ทับของเดิม → บันทึก

### 2. Deploy เป็น Web app
Apps Script → **Deploy → Manage deployments → ✏️ แก้ไข deployment เดิม → Version: New version → Deploy**
- Execute as: **Me** · Who has access: **Anyone**
- ใช้ deployment เดิม URL `/exec` จะไม่เปลี่ยน → LINE webhook ใช้ต่อได้ทันที
- ระบบจะขออนุญาตสิทธิ์ใหม่ 1 ครั้ง (กด Allow)
- เปิด URL `/exec` ในเบราว์เซอร์ ต้องเห็น `{"ok":true,"service":"dorm-api",...}`

### 3. ใส่ลิงก์ API ในหน้าเว็บ
แก้ `docs/config.js` วาง URL `/exec` ลงใน `window.DORM_API_URL = '...'`

### 4. เปิด GitHub Pages
GitHub repo → **Settings → Pages → Build and deployment**
- Source: **Deploy from a branch** · Branch: **main** · Folder: **/docs** → Save
- รอ 1–2 นาที เว็บจะอยู่ที่ `https://<user>.github.io/<repo>/`

> GitHub Pages ฟรีใช้ได้กับ repo สาธารณะ (โค้ดอ่านได้ แต่ไม่มีข้อมูลลับในโค้ด — ข้อมูลอยู่ใน Sheet และต้องล็อกอิน)
> ห้าม commit ไฟล์ข้อมูลจริง (`outputs/`, `spreadsheet_work/`, `_backup_*/` ถูกกันไว้ใน `.gitignore` แล้ว)

---

## ใช้งานประจำวัน
```bash
git add . && git commit -m "อธิบายสิ่งที่แก้" && git push   # หน้าเว็บอัปเดตเองใน 1–2 นาที
clasp push                                               # ถ้าแก้ Code.js แล้วทำข้อ 2 (New version) อีกครั้ง
```

## ความปลอดภัย
- เปลี่ยนรหัสแอดมินได้ที่หน้า "ตั้งค่าระบบ" (เว้นว่าง = ใช้รหัสเดิม)
- สงสัยว่ารหัสหลุด: เปลี่ยนรหัส แล้วรันฟังก์ชัน `logoutAllSessions` ใน Apps Script editor 1 ครั้ง (ทุกเครื่องต้องล็อกอินใหม่)
- ใส่รหัสผิด 10 ครั้ง ระบบล็อกการล็อกอิน 15 นาที

## (ทางเลือก) Auto-deploy API ด้วย GitHub Actions
ดู `.github/workflows/deploy.yml.example` — ใส่ Secrets `CLASPRC_JSON`, `SCRIPT_ID`, `DEPLOYMENT_ID` แล้วเปลี่ยนชื่อไฟล์เป็น `deploy.yml`
push ที่แก้ `Code.js` จะอัปเดต Apps Script + deployment เดิมให้อัตโนมัติ

## ไฟล์หลัก
| ไฟล์ | หน้าที่ |
|---|---|
| `docs/index.html` | หน้าเว็บ (GitHub Pages) |
| `docs/config.js` | ลิงก์ API (URL `/exec`) |
| `Code.js` | API + LINE webhook (Apps Script) |
| `appsscript.json` | manifest ของ Apps Script |
| `.claspignore` | ให้ clasp ส่งขึ้น Apps Script เฉพาะ `Code.js` + `appsscript.json` |

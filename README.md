# Bank Central Template Converter

แอปพลิเคชันแปลงไฟล์รายการเดินบัญชีธนาคารหลายรูปแบบ เป็น "Template กลาง" เดียวกัน  
สำหรับวิเคราะห์เส้นทางการเงินและตรวจสอบรายการซ้ำจากหลายบัญชี

---

## ✅ Features

- 📁 **Upload** ไฟล์ได้หลายไฟล์พร้อมกัน (.xlsx, .xls, .csv, .tsv)
- 🔍 **ตรวจจับ Template อัตโนมัติ** — KBank CIB, Prasan Template04
- 🗺️ **Template Mapper** — กำหนด mapping เองพร้อม Auto-suggest ภาษาไทย/อังกฤษ
- 🔁 **Deduplication** — SHA-256 key + Possible Duplicate (window 60 วินาที)
- 📊 **Transactions Table** — filter, search, คลิกดู raw data
- ⬇️ **Export** CSV, XLSX, JSON, Mapping Template JSON
- 💾 **IndexedDB** — เก็บ Template และ Transaction ใน browser
- 🆓 **ฟรี 100%** — Static Web App ไม่ต้องการ server

---

## 🚀 วิธีรัน

### แบบที่ 1: เปิดในเครื่อง (ง่ายที่สุด)

> ⚠️ Browser บางตัวบล็อก script เมื่อเปิดไฟล์ตรงจาก `file://`  
> แนะนำให้ใช้ **VS Code + Live Server** หรือ **Python simple server**

#### วิธี A — VS Code Live Server
1. ติดตั้ง VS Code จาก https://code.visualstudio.com
2. ติดตั้ง Extension **"Live Server"** (ritwickdey.LiveServer)
3. เปิดโฟลเดอร์ `bank-template-converter` ใน VS Code
4. คลิกขวาที่ `index.html` → **"Open with Live Server"**
5. Browser จะเปิด `http://127.0.0.1:5500` อัตโนมัติ

#### วิธี B — Python (ถ้ามี Python)
```bash
cd bank-template-converter
python -m http.server 8080
# เปิด http://localhost:8080
```

#### วิธี C — Node.js (ถ้ามี Node)
```bash
cd bank-template-converter
npx serve .
# เปิด http://localhost:3000
```

---

### แบบที่ 2: Deploy บน GitHub Pages (ฟรี, เข้าได้ทุกที่)

**ขั้นตอน:**

1. **สร้าง GitHub Account** ที่ https://github.com (ถ้ายังไม่มี)

2. **สร้าง Repository ใหม่**
   - กด **"New"** (สีเขียว)
   - Repository name: `bank-template-converter`
   - เลือก **Public**
   - กด **"Create repository"**

3. **Upload ไฟล์ทั้งหมด**
   - กด **"uploading an existing file"**
   - ลากโฟลเดอร์ทั้งหมดเข้าไป หรืออัปโหลดทีละไฟล์
   - ต้องมีไฟล์: `index.html`, `styles.css`, `app.js`, โฟลเดอร์ `js/`, โฟลเดอร์ `components/`
   - กด **"Commit changes"**

4. **เปิด GitHub Pages**
   - ไปที่ **Settings** ของ repository
   - เมนูซ้าย: **Pages**
   - Source: **Deploy from a branch**
   - Branch: **main** → folder: **/ (root)**
   - กด **Save**

5. **รอสักครู่** (~2-3 นาที) แล้วจะได้ URL:
   ```
   https://[username].github.io/bank-template-converter/
   ```

---

### แบบที่ 3: Deploy บน Cloudflare Pages (เร็วที่สุด)

1. ไปที่ https://pages.cloudflare.com → **"Create a project"**
2. เลือก **"Direct Upload"**
3. ตั้งชื่อ project → อัปโหลดโฟลเดอร์ทั้งหมด
4. กด **Deploy** → ได้ URL ทันที เช่น `bank-template-converter.pages.dev`

---

## 📋 โครงสร้างไฟล์

```
bank-template-converter/
├── index.html              ← Entry point
├── styles.css              ← Dark theme styles
├── app.js                  ← Main React app (Babel)
├── js/
│   ├── storage.js          ← IndexedDB wrapper
│   ├── normalizer.js       ← Data normalization (Thai date, amount ฯลฯ)
│   ├── templateRegistry.js ← Template definitions + detection
│   ├── parser.js           ← XLSX/CSV/TSV parser
│   ├── mapper.js           ← Column mapping + fuzzy match
│   ├── converter.js        ← Canonical conversion + direction logic
│   ├── dedupe.js           ← SHA-256 dedup + possible duplicate
│   └── exporter.js         ← Export CSV/XLSX/JSON
└── components/
    ├── Layout.jsx           ← Sidebar, Topbar, Toast, Modal
    ├── Pages.jsx            ← Upload, Detection, Export pages
    ├── MapperPage.jsx       ← Template Mapper UI
    └── Transactions.jsx     ← Transactions table + Duplicate review
```

---

## 🏦 Template ที่รองรับ

| Template | Headers | Auto-detect |
|---|---|---|
| **KBank CIB** | ภาษาไทย 38 คอลัมน์ header row 4 | ✅ |
| **Prasan Template04** | English 30 คอลัมน์ header row 1 | ✅ |
| **Custom** | กำหนดเองผ่าน Template Mapper | ✅ |

---

## 📐 Template กลาง (Canonical Fields)

ฟิลด์สำคัญ:

| ฟิลด์ | คำอธิบาย |
|---|---|
| `txid` | Transaction ID ที่ระบบสร้างให้ |
| `dedupe_key` | SHA-256 hash สำหรับตรวจ duplicate |
| `duplicate_status` | UNIQUE / MASTER / DUPLICATE / POSSIBLE_DUPLICATE / MERGED |
| `tx_direction` | IN หรือ OUT |
| `amount` | ยอดเงิน (เดียว, แปลงจาก deposit/withdrawal แล้ว) |
| `from_account_no` | หมายเลขบัญชีต้นทาง |
| `to_account_no` | หมายเลขบัญชีปลายทาง |
| `raw_json` | ข้อมูล row ต้นฉบับในรูป JSON |
| `source_file_name` | ชื่อไฟล์ที่มาจาก |
| `source_row_no` | แถวที่ในไฟล์ต้นฉบับ |

---

## ⚖️ ข้อควรระวัง

- ข้อมูลต้นฉบับ **ไม่ถูกแก้ไข** ทุก row เก็บ `raw_json` ไว้เสมอ
- ระบบนี้ใช้เพื่อ **ช่วยจัดข้อมูล** เท่านั้น ไม่ใช่หลักฐานโดยตรง
- ควรตรวจสอบ Possible Duplicate ด้วยตาเองก่อน Merge
- Audit log ทุกการ Merge/Separate เก็บใน IndexedDB

---

## 💡 Tips

- **ไฟล์ KBank CIB**: วันที่เป็น พ.ศ. ระบบแปลงเป็น ค.ศ. ให้อัตโนมัติ
- **อัปโหลดหลายบัญชีพร้อมกัน**: ระบบจะ detect duplicate ข้ามไฟล์ให้
- **บันทึก Template**: Template ที่ Map แล้วจะถูกเก็บในเครื่องและใช้ครั้งต่อไปได้ทันที
- **Export ทุกครั้ง**: ก่อนปิด Browser ควร Export ข้อมูลออกเพื่อสำรองไว้

---

*Built with React + SheetJS + PapaParse + Web Crypto API · No backend · Free*

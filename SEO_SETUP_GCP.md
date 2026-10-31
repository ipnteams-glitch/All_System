# ตั้งค่า Google Cloud สำหรับ SEO automation (Layer C)

คู่มือนี้ทำครั้งเดียว เพื่อเปิดใช้งาน 2 workflow:

- **SEO rank dashboard** (`.github/workflows/seo-rank-dashboard.yml`) — ดึงอันดับคำค้นจาก Google Search Console ทุกสัปดาห์ มาเป็นรายงาน (ดูในหน้า Actions + ดาวน์โหลดไฟล์ HTML ได้)
- **Google Indexing API ping** (`.github/workflows/indexing-api.yml`) — เมื่อ push แก้ไฟล์ `.html` จะแจ้ง Google ให้มาเก็บหน้าใหม่

ทั้งสองใช้ **service account ตัวเดียวกัน** และ GitHub secret ชื่อ `GCP_SA_KEY` เหมือนกัน ถ้ายังไม่ได้ใส่ secret ทั้งสอง workflow จะรันแล้วข้ามไปเฉย ๆ ไม่ error

> หมายเหตุเรื่อง Indexing API: Google รองรับอย่างเป็นทางการเฉพาะหน้าที่มี structured data ชนิด `JobPosting` หรือ `BroadcastEvent` หน้าอื่นมักส่งได้แต่ไม่การันตีว่าจะเก็บเร็วขึ้น ช่องทางหลักของเว็บนี้ยังเป็น sitemap ใน Search Console ส่วน IndexNow (ตั้งไว้แล้ว) ดูแลฝั่ง Bing/Yandex

---

## ขั้นตอน (ประมาณ 10 นาที)

### 1. สร้างโปรเจกต์ Google Cloud

1. เปิด https://console.cloud.google.com/
2. บนแถบบนสุด กด dropdown เลือกโปรเจกต์ → **New Project**
3. ตั้งชื่อ เช่น `forexcool-seo` → **Create** → เลือกโปรเจกต์นั้น

### 2. เปิด API 2 ตัว

เปิดทีละลิงก์ (ต้องเลือกโปรเจกต์ให้ถูกก่อน) แล้วกด **Enable**:

1. Google Search Console API — https://console.cloud.google.com/apis/library/searchconsole.googleapis.com
2. Web Search Indexing API — https://console.cloud.google.com/apis/library/indexing.googleapis.com

### 3. สร้าง service account + คีย์ JSON

1. ไปที่ https://console.cloud.google.com/iam-admin/serviceaccounts
2. **Create Service Account** → ชื่อ เช่น `seo-bot` → **Create and Continue** → ข้าม role (กด **Continue** / **Done**)
3. คลิกเข้า service account ที่เพิ่งสร้าง → แท็บ **Keys** → **Add Key → Create new key → JSON → Create**
4. ไฟล์ `.json` จะถูกดาวน์โหลด — **เก็บเป็นความลับ ห้าม commit เข้า repo**
5. จดอีเมลของ service account ไว้ หน้าตาแบบนี้: `seo-bot@forexcool-seo.iam.gserviceaccount.com`

### 4. เพิ่ม service account เป็น Owner ใน Search Console

1. เปิด https://search.google.com/search-console → เลือก property `https://www.forexcool.com/`
2. **Settings (ตั้งค่า) → Users and permissions (ผู้ใช้และสิทธิ์) → Add user (เพิ่มผู้ใช้)**
3. วางอีเมล service account จากข้อ 3.5
4. Permission = **Owner (เจ้าของ)** → **Add**

> ต้องเป็น Owner เพราะ Indexing API บังคับให้ service account เป็นเจ้าของเว็บที่ verify แล้ว (สิทธิ์ Owner ครอบคลุม dashboard ด้วย)

### 5. ใส่คีย์เป็น GitHub secret

1. เปิด repo บน GitHub → **Settings → Secrets and variables → Actions**
2. **New repository secret**
   - Name: `GCP_SA_KEY`
   - Secret: วาง **เนื้อหาทั้งไฟล์** JSON จากข้อ 3.4 (ตั้งแต่ `{` ถึง `}`)
3. **Add secret**

เสร็จแล้ว ลบไฟล์ JSON ออกจากเครื่องได้ (ค่าอยู่ใน secret แล้ว)

---

## ทดสอบ

ที่แท็บ **Actions** ของ repo:

- **SEO rank dashboard** → **Run workflow** → เปิด run ดู summary (ตารางคำค้น + หน้า) และดาวน์โหลด artifact `seo-rank-dashboard`
  - ช่วงแรกตารางอาจว่าง เพราะ Search Console เพิ่งเริ่มเก็บข้อมูล (ต้องรอ 2–3 วันหลัง index)
- **Google Indexing API ping** → **Run workflow** → ปล่อยช่อง URL ว่างไว้ไม่ได้ (ไม่มีไฟล์เปลี่ยน) ให้ใส่เอง เช่น
  `https://www.forexcool.com/ https://www.forexcool.com/index_en.html`

หลังตั้งค่าเสร็จ dashboard จะรันเองทุกวันจันทร์ 01:00 UTC และ Indexing API จะยิงเองทุกครั้งที่ push แก้หน้า `.html`

---

## สรุปสิ่งที่ทำงานอยู่ (Layer C)

| Automation | ทริกเกอร์ | ต้องมี secret |
|---|---|---|
| IndexNow (Bing/Yandex) | push แก้ `.html` | ไม่ต้อง (ตั้งเสร็จแล้ว) |
| Google Indexing API | push แก้ `.html` | `GCP_SA_KEY` |
| SEO rank dashboard | ทุกวันจันทร์ + รันเอง | `GCP_SA_KEY` |

# 💡 EXAMBANK - แพลตฟอร์มคลังข้อสอบและจัดการแบบทดสอบออนไลน์

**EXAMBANK** คือเว็บแอปพลิเคชันสำหรับการทำแบบทดสอบและจัดการคลังข้อสอบออนไลน์ที่ถูกออกแบบมาเพื่อให้ใช้งานง่าย สบายตา และมีประสิทธิภาพ รองรับทั้งมุมมองของผู้เรียน (ผู้ทำข้อสอบ) และผู้สอน (ผู้ดูแลระบบ) ครอบคลุมตั้งแต่การสุ่มโจทย์ จับเวลา ไปจนถึงการวิเคราะห์สถิติและข้อผิดพลาดเพื่อนำไปทบทวน

---

## ✨ ฟีเจอร์หลัก (Key Features)

### 👨‍🎓 สำหรับผู้ใช้งานทั่วไป / นักเรียน (User Section)

- **Smart Exam Session:** ระบบทำข้อสอบที่สามารถเลือกกำหนดจำนวนข้อ และเวลาในการสอบได้เอง (มีระบบ Countdown Timer)
- **Randomization:** ระบบสุ่มลำดับข้อสอบและสลับตัวเลือกคำตอบอัตโนมัติ เพื่อป้องกันการจำแพทเทิร์น
- **Subject Code Search:** รองรับการค้นหารายวิชาด้วยชื่อ หรือพิมพ์รหัสประจำวิชา (เช่น `#486002`)
- **Mistake Bank:** คลังข้อผิดพลาดที่รวบรวมข้อสอบที่เคยตอบผิดไว้ให้กลับมาทบทวน พร้อมเฉลยคำอธิบายอย่างละเอียด
- **Analytics Dashboard:** หน้าแสดงสถิติการสอบ ความคืบหน้า และคะแนนที่ทำได้เพื่อวิเคราะห์จุดอ่อน-จุดแข็ง

### ⚙️ สำหรับผู้สอน / ผู้ดูแลระบบ (Admin Section)

- **Category Management:** ระบบสร้าง แก้ไข และเปิด-ปิดสถานะหมวดหมู่วิชา
- **Question Management:** ระบบจัดการข้อสอบที่รองรับการแนบรูปภาพในโจทย์และคำอธิบายเฉลย
- **Bulk Import:** ระบบนำเข้าข้อสอบทีละหลายๆ ข้อพร้อมกัน ช่วยประหยัดเวลาในการเตรียมสอบ
- **User Management:** ระบบจัดการข้อมูลผู้ใช้งาน และกำหนดสิทธิ์ (Role) ระหว่าง Student, Creator และ Admin

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend:** React.js (สร้างด้วย Vite)
- **Styling:** Tailwind CSS (เน้นความสวยงาม สบายตาแบบ Modern UI)
- **Routing:** React Router DOM
- **Backend & Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (รองรับระบบ Role-based access control)
- **Deployment:** Vercel

---

# 🚀 การติดตั้งและเรียกใช้งานในเครื่อง (Local Setup)

หากต้องการนำโปรเจคนี้ไปรันในเครื่องคอมพิวเตอร์ของคุณ ให้ทำตามขั้นตอนดังนี้

## 1. Clone โปรเจคลงมาที่เครื่อง

```bash
git clone https://github.com/pornprompoh/Exam_website.git
cd Exam_website
```

## 2. ติดตั้ง Dependencies ทั้งหมด

```bash
npm install
```

## 3. ตั้งค่าการเชื่อมต่อฐานข้อมูล (Environment Variables)

สร้างไฟล์ชื่อ `.env` หรือ `.env.local` ไว้ที่โฟลเดอร์นอกสุดของโปรเจค และใส่ข้อมูลการเชื่อมต่อ Supabase ของคุณลงไป

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 4. รันเซิร์ฟเวอร์จำลอง

```bash
npm run dev
```

ระบบจะเปิดใช้งานที่

```text
http://localhost:5173
```

---

# 🌐 การนำขึ้นระบบออนไลน์ (Deployment)

โปรเจคนี้มีการตั้งค่ารองรับการ Deploy ผ่าน Vercel เรียบร้อยแล้ว (มีไฟล์ `vercel.json` สำหรับจัดการ Routing ของ SPA ป้องกันบั๊ก Error 404 เวลาผู้ใช้รีเฟรชหน้าเว็บ)

### ข้อควรระวังตอน Deploy บน Vercel

- ไปที่ **Settings > General > Build & Development Settings**
- ตั้งค่า **Build Command** เป็น

```text
npm run build
```

- ตั้งค่า **Output Directory** เป็น

```text
dist
```

- ตั้งค่า **Install Command** เป็น

```text
npm install
```

- อย่าลืมนำค่าในไฟล์ `.env` ไปใส่ในเมนู **Environment Variables** ของ Vercel ด้วย

---

# 📝 โครงสร้างโปรเจค (Project Structure)

```text
src/
 ├── assets/          # รูปภาพประกอบและไอคอน
 ├── components/      # UI Components ที่ใช้งานซ้ำ (Navbar, Modal, Loading)
 ├── context/         # ตัวจัดการ Context API (เช่น ModalContext)
 ├── lib/             # ไฟล์ตั้งค่าเครื่องมือภายนอก (supabase.js)
 ├── pages/           # หน้าจอต่างๆ ของเว็บไซต์แบ่งตามระบบ
 │   ├── admin/       # หน้าจัดการหลังบ้าน (CategoryManager, QuestionManager ฯลฯ)
 │   ├── auth/        # หน้าเข้าสู่ระบบ (Login)
 │   └── user/        # หน้าหลักของผู้ทำข้อสอบ (Home, ExamSession, Analytics ฯลฯ)
 ├── App.jsx          # จุดศูนย์รวม Routing ของเว็บไซต์
 └── main.jsx         # จุดเริ่มต้น (Entry Point) ของแอปพลิเคชัน
```

# โครงสร้างโปรเจค Exam Website (`PROJECT_STRUCTURE.md`)

เอกสารนี้อธิบายสถาปัตยกรรมโค้ดแบบ **Feature-Based Modular Architecture** ตามหลัก **Single Responsibility Principle (SRP — 1 ไฟล์ = 1 หน้าที่ชัดเจน)** เพื่อให้ทีมนักพัฒนาสามารถค้นหาไฟล์ แก้ไขบั๊ก และเพิ่มฟีเจอร์ใหม่ได้ทันทีโดยไม่กระทบส่วนอื่น

---

## 1. หลักการสถาปัตยกรรม (Architecture Principles)

### 1.1 ทิศทางการพึ่งพา (Unidirectional Dependency Rule — Zero Circular Dependencies)
```text
src/main.jsx
   └── src/app/          (Bootstrap, Router, Providers, Layouts, Route Guards)
        ├── src/features/*   (Domain Features แยกอิสระต่อกัน)
        │    └── (Admin: admin-questions -> admin-ai/{generator,extractor,auditor} -> admin-ai/shared)
        └── src/shared/      (Cross-feature UI, Context, Hooks, Core Libs)
```
- **ห้าม** `shared/` import จาก `features/` หรือ `app/`
- **ห้าม** ฟีเจอร์ข้ามสาย import วนกันเอง (เช่น `exam/` ห้าม import จาก `admin-questions/`, `admin-ai/*` ห้าม import จาก `admin-questions/`)
- โค้ดที่ใช้ร่วมกันข้ามฟีเจอร์ทั้งหมดอยู่ที่ `src/shared/` และโค้ดที่ใช้ร่วมกันเฉพาะกลุ่ม AI อยู่ที่ `src/features/admin-ai/shared/`

### 1.2 มาตรฐานการตั้งชื่อไฟล์ (Naming Conventions)
| ประเภทไฟล์ | รูปแบบชื่อ | หน้าที่รับผิดชอบ |
|---|---|---|
| Page Component | `*Page.jsx` | ประกอบ Layout และเชื่อม Hook กับ UI Components |
| UI Component | `PascalCase.jsx` | แสดงผล UI และรับ Event ผ่าน Props (ไม่เรียก Supabase โดยตรง) |
| Custom Hook | `useCamelCase.js` | จัดการ State, Lifecycle, Effects และ User Actions ของฟีเจอร์ |
| Service | `*Service.js` | สื่อสารกับ Supabase, Storage, Gemini API และ Checkpoint |
| AI Prompt | `*Prompt.js` / `*Prompts.js` | เก็บ System Instruction และ Prompt Builder ของแต่ละงาน AI |
| Utility / Parser | `*Utils.js` / `*Parser.js` / `*Storage.js` | Pure Functions (คำนวณ, แปลงข้อความ, Shuffle, LocalStorage) |

---

## 2. โครงสร้างโฟลเดอร์ทั้งหมด (`src/`)

```text
src/
├── main.jsx                                  # Entry point (ReactDOM root)
├── index.css                                 # Global styles, Tailwind CSS v4 & dark-mode cascade guard
│
├── app/                                      # ชั้นควบคุมแอปและ Routing
│   ├── App.jsx                               # Router หลัก + ThemeProvider + ModalProvider
│   ├── AdminLayout.jsx                       # Layout ฝั่งผู้ดูแลระบบ + แท็บเมนูหลัก
│   ├── ProtectedAdminRoute.jsx               # Route Guard ตรวจสิทธิ์ admin / creator
│   └── ScrollRestoration.jsx                 # รีเซ็ตตำแหน่ง Scroll เมื่อเปลี่ยนหน้า
│
├── shared/                                   # โค้ดที่ใช้ร่วมกันข้ามทุกฟีเจอร์
│   ├── lib/
│   │   ├── supabase.js                       # Supabase Client Instance
│   │   ├── supabasePagination.js             # PostgREST Pagination เกิน 1,000 แถว + Exact Count + Batch Runner
│   │   ├── geminiApiKey.js                   # จัดการ Gemini API Key ใน localStorage
│   │   └── geminiModels.js                   # รายชื่อโมเดล Gemini + Hybrid Routing Pair (Flash Lite / Standard)
│   ├── context/
│   │   ├── ThemeContext.jsx                  # Light / Dark Mode Provider
│   │   └── ModalContext.jsx                  # Global Confirm / Alert Modal Provider
│   ├── hooks/
│   │   └── useCategories.js                  # โหลดรายการหมวดหมู่วิชาพร้อมนับจำนวนข้อสอบจริง (>1,000 ข้อ)
│   └── components/
│       ├── AdminIcons.jsx                    # ชุด SVG Icon มาตรฐานฝั่ง Admin
│       ├── AdminModalShell.jsx               # กรอบ Modal/Drawer มาตรฐานพร้อม Backdrop, Escape & Header/Footer
│       ├── BatchActionBar.jsx                # แถบ Action ลอยด้านล่างสำหรับ Bulk Operations
│       ├── ConfirmModal.jsx                  # กล่องยืนยัน / แจ้งเตือนมาตรฐาน
│       ├── EmptyState.jsx                    # หน้าจอแสดงเมื่อไม่มีข้อมูล
│       ├── LoadingScreen.jsx                 # หน้าจอโหลดข้อมูล
│       ├── Navbar.jsx                        # แถบนำทางหลัก (Student + Admin + Theme Switch)
│       └── PaginationBar.jsx                 # แถบเปลี่ยนหน้า + กระโดดไปหน้า/ข้อที่ต้องการ
│
└── features/                                 # ฟีเจอร์แยกตามโดเมนธุรกิจ
    ├── auth/                                 # ระบบเข้าสู่ระบบ / สมัครสมาชิก / ลืมรหัสผ่าน
    │   ├── services/authService.js
    │   ├── hooks/useAuthForm.js
    │   └── pages/LoginPage.jsx
    │
    ├── home/                                 # หน้าแรกเลือกหมวดหมู่วิชาสอบ
    │   ├── components/HomeSearchFilter.jsx
    │   ├── components/SubjectCard.jsx
    │   └── pages/HomePage.jsx
    │
    ├── exam/                                 # ระบบทำข้อสอบ + สุ่มข้อ + Auto-Save 7 วัน + ตรวจคำตอบ
    │   ├── utils/examShuffleUtils.js         # Fisher-Yates shuffle, choice mapping, grading & time format
    │   ├── utils/examAutosaveStorage.js      # บันทึก/กู้คืนเซสชันสอบใน localStorage (TTL 7 วัน)
    │   ├── services/examService.js           # ดึงข้อสอบ >1,000 ข้อ, Smart Randomize & บันทึกผลสอบ/ข้อผิดพลาด
    │   ├── hooks/useExamAutosave.js          # Auto-Save lifecycle & resume prompt
    │   ├── hooks/useExamSession.js           # State เครื่องสอบทั้งหมด (setup / active / review)
    │   ├── components/ExamSetupView.jsx      # หน้าตั้งค่าจำนวนข้อและโหมดการสอบ
    │   ├── components/ExamGuardModals.jsx    # Modal ยืนยันส่งข้อสอบ / ออกจากหน้าสอบ / กู้คืนเซสชัน
    │   ├── components/ExamHeader.jsx         # แถบเวลา ความคืบหน้า และปุ่มส่งข้อสอบ
    │   ├── components/QuestionCard.jsx       # การ์ดโจทย์และตัวเลือกขณะทำสอบ
    │   ├── components/ExamNavigator.jsx      # แผงกระโดดข้ามข้อ + กรองข้อที่ยังไม่ตอบ/ติดธง
    │   ├── components/ExamReviewCard.jsx     # การ์ดเฉลยรายข้อหลังส่งคำตอบ
    │   ├── components/ExamReviewList.jsx     # หน้าสรุปคะแนน + รายการเฉลยทั้งหมด
    │   └── pages/ExamSessionPage.jsx
    │
    ├── mistake-bank/                         # คลังข้อผิดพลาดส่วนตัวของผู้เรียน
    │   ├── services/mistakeBankService.js
    │   ├── hooks/useMistakeBank.js
    │   ├── components/MistakeCard.jsx
    │   └── pages/MistakeBankPage.jsx
    │
    ├── analytics/                            # สถิติผลการสอบและประวัติย้อนหลัง
    │   ├── services/analyticsService.js
    │   ├── hooks/useAnalytics.js
    │   ├── components/AnalyticsKpiGrid.jsx
    │   ├── components/SubjectPerformanceGrid.jsx
    │   ├── components/RecentExamLogs.jsx
    │   └── pages/AnalyticsPage.jsx
    │
    ├── profile/                              # จัดการโปรไฟล์และเปลี่ยนรหัสผ่าน
    │   ├── services/profileService.js
    │   ├── hooks/useProfile.js
    │   └── pages/ProfilePage.jsx
    │
    ├── admin-categories/                     # แอดมิน: จัดการหมวดหมู่วิชา & แชร์สิทธิ์ Creator
    │   ├── services/categoryService.js
    │   ├── hooks/useCategoryManager.js
    │   ├── components/ShareCategoryModal.jsx
    │   └── pages/CategoryManagerPage.jsx
    │
    ├── admin-users/                          # แอดมิน: จัดการผู้ใช้งานและบทบาท (Role)
    │   ├── services/userService.js
    │   ├── hooks/useUserManager.js
    │   └── pages/UserManagerPage.jsx
    │
    ├── admin-questions/                      # แอดมิน: จัดการคลังข้อสอบ + Bulk Import
    │   ├── utils/bulkImportParser.js         # Parser แปลงข้อความคั่นด้วย --- และ Magic Prompt
    │   ├── services/questionService.js       # CRUD ข้อสอบ, อัปโหลด/บีบอัดรูป WebP, Bulk Actions
    │   ├── hooks/useQuestionManager.js       # State หน้าคลังข้อสอบ, Pagination, Jump & Modals
    │   ├── components/QuestionFilterBar.jsx  # ตัวเลือกหมวดหมู่ + ค้นหา
    │   ├── components/QuestionToolsMenu.jsx  # เมนูรวมเครื่องมือ AI & นำเข้าชุดใหญ่
    │   ├── components/QuestionStatusStrip.jsx # แถบแจ้งเตือนข้อ Flagged / Draft Staging
    │   ├── components/QuestionForm.jsx       # ฟอร์มสร้าง/แก้ไขโจทย์และรูปภาพ
    │   ├── components/QuestionList.jsx       # รายการการ์ดข้อสอบ + BatchActionBar
    │   ├── components/QuestionTable.jsx      # ตัวกรองคำค้นหาเหนือ QuestionList
    │   ├── components/BulkImportModal.jsx    # Modal วางข้อความนำเข้าชุดใหญ่
    │   └── pages/QuestionManagerPage.jsx
    │
    └── admin-ai/                             # แอดมิน: เครื่องมือ AI ทั้งหมด (แยกโดเมนย่อยชัดเจน)
        ├── shared/                           # Utility & UI ที่ใช้ร่วมกันระหว่าง AI Tools
        │   ├── utils/geminiClientUtils.js    # RPM Pacer, Abortable Sleep & Gemini JSON Retry Client
        │   ├── utils/pdfPipelineUtils.js     # Lazy PDF.js Reader (300+ หน้า), Vision Renderer & Fingerprint
        │   ├── utils/examTextFormatUtils.js  # แปลงเลขไทย, ตัด prefix, แปลง LaTeX/ตารางเป็น Unicode, Exact Match
        │   ├── utils/partialJsonUtils.js     # กู้คืน JSON ที่ถูกตัดกลางคัน (MAX_TOKENS Partial Recovery)
        │   ├── components/AIKeyRequiredModal.jsx
        │   ├── components/FileUploadDropzone.jsx
        │   └── components/ExamPreviewTable.jsx
        │
        ├── settings/                         # หน้าตั้งค่า Gemini API Key & โมเดลเริ่มต้น
        │   └── pages/AISettingsPage.jsx
        │
        ├── generator/                        # ฟีเจอร์ 1: AI สร้างข้อสอบใหม่จากเอกสาร
        │   ├── prompts/examGeneratorPrompt.js
        │   ├── utils/generatorDedupeUtils.js
        │   ├── services/examGeneratorService.js
        │   ├── components/GeneratorSettings.jsx
        │   └── components/AIExamGeneratorModal.jsx
        │
        ├── extractor/                        # ฟีเจอร์ 2: AI ดึงข้อสอบตามต้นฉบับ (3-Pass Hybrid + Staging)
        │   ├── prompts/examExtractorPrompts.js
        │   ├── utils/answerKeyMatchingUtils.js   # Pass 1 Validation + Pass 2 Multi-Set Answer Key Matching
        │   ├── services/extractionCheckpointService.js # Supabase + localStorage Checkpoint & Key Pool
        │   ├── services/stagingQuestionService.js      # Staging CRUD, Exact Dedup, Pass 2–3 Save & Publish
        │   ├── services/extractorPass3Service.js       # Stage 3A (Flash Lite) -> Stage 3B (Flash Standard + Fallback)
        │   ├── services/examExtractorService.js        # Orchestrator หลักของ Pass 1 -> 2 -> 3 & Deferred Runner
        │   ├── hooks/useExamExtractor.js
        │   ├── components/ExtractorStepperBar.jsx
        │   ├── components/ExtractorUploadTab.jsx
        │   ├── components/ExtractorStagingTab.jsx
        │   ├── components/OverrideReasonModal.jsx
        │   └── components/AIExamExtractorModal.jsx
        │
        └── auditor/                          # ฟีเจอร์ 3: AI ตรวจทานความถูกต้องของเฉลยในคลัง (3 ด่าน)
            ├── prompts/answerAuditorPrompts.js
            ├── utils/auditorLocalUtils.js        # Stage 0 Local Pre-Check & Quota Estimator
            ├── services/auditorDbService.js      # สถิติ audit_status, Flagged CRUD & Auto-Cleanup on Resolve
            ├── services/auditorPipelineService.js # Stage 0 -> Stage 1 (Mega-Batch Lite) -> Stage 2 (Standard)
            ├── hooks/useExamAuditor.js
            ├── components/AuditorScanTab.jsx
            ├── components/AuditorFlaggedCard.jsx
            ├── components/AuditorFlaggedTab.jsx
            └── components/AIExamAuditorModal.jsx
```

---

## 3. คู่มือลัด: อยากแก้ตรงไหน → ไปที่ไฟล์ไหน (Quick Edit Guide)

| สิ่งที่ต้องการแก้ไข / ปรับปรุง | ไฟล์เป้าหมายที่ต้องไปดู |
|---|---|
| **Routing / เพิ่มหน้าใหม่ / Route Guard** | `src/app/App.jsx`, `src/app/AdminLayout.jsx`, `src/app/ProtectedAdminRoute.jsx` |
| **Navbar / ปุ่มสลับ Light-Dark Mode** | `src/shared/components/Navbar.jsx`, `src/shared/context/ThemeContext.jsx` |
| **แก้ปัญหา Supabase PostgREST Limit 1,000 แถว** | `src/shared/lib/supabasePagination.js` |
| **เพิ่ม/เปลี่ยนรายชื่อโมเดล Gemini หรือ Hybrid Pair** | `src/shared/lib/geminiModels.js` |
| **หน้าล็อกอิน / สมัครสมาชิก / ลืมรหัสผ่าน** | `src/features/auth/pages/LoginPage.jsx`, `src/features/auth/hooks/useAuthForm.js` |
| **หน้าแรก / การ์ดวิชา / ช่องค้นหาวิชา** | `src/features/home/pages/HomePage.jsx`, `src/features/home/components/SubjectCard.jsx` |
| **สูตรสุ่มข้อสอบ / สุ่มชอยส์ / คำนวณคะแนน** | `src/features/exam/utils/examShuffleUtils.js`, `src/features/exam/services/examService.js` |
| **ระบบ Auto-Save 7 วันขณะทำข้อสอบ** | `src/features/exam/utils/examAutosaveStorage.js`, `src/features/exam/hooks/useExamAutosave.js` |
| **UI หน้าเลือกจำนวนข้อ / การ์ดโจทย์ / แผงกระโดดข้ามข้อ / เฉลย** | `src/features/exam/components/ExamSetupView.jsx`, `QuestionCard.jsx`, `ExamNavigator.jsx`, `ExamReviewList.jsx` |
| **คลังข้อผิดพลาด (Mistake Bank)** | `src/features/mistake-bank/services/mistakeBankService.js`, `pages/MistakeBankPage.jsx` |
| **หน้าสถิติผลการสอบ (Analytics)** | `src/features/analytics/services/analyticsService.js`, `pages/AnalyticsPage.jsx` |
| **หน้าโปรไฟล์และเปลี่ยนรหัสผ่าน** | `src/features/profile/hooks/useProfile.js`, `pages/ProfilePage.jsx` |
| **แอดมิน: สร้าง/แก้ไขหมวดหมู่ หรือแชร์สิทธิ์ Creator** | `src/features/admin-categories/services/categoryService.js`, `components/ShareCategoryModal.jsx` |
| **แอดมิน: จัดการรายชื่อและสิทธิ์ผู้ใช้** | `src/features/admin-users/services/userService.js`, `pages/UserManagerPage.jsx` |
| **แอดมิน: ฟอร์มสร้าง/แก้ไขโจทย์ + อัปโหลดรูป WebP** | `src/features/admin-questions/components/QuestionForm.jsx`, `services/questionService.js` |
| **แอดมิน: ตารางรายการข้อสอบ / Bulk Move / Bulk Delete** | `src/features/admin-questions/components/QuestionList.jsx`, `hooks/useQuestionManager.js` |
| **แอดมิน: นำเข้าชุดใหญ่ด้วยการวางข้อความ (`---`)** | `src/features/admin-questions/utils/bulkImportParser.js`, `components/BulkImportModal.jsx` |
| **ตั้งค่า Gemini API Key & โมเดลเริ่มต้น** | `src/features/admin-ai/settings/pages/AISettingsPage.jsx`, `src/shared/lib/geminiApiKey.js` |
| **RPM Pacer / Retry 429 / Timeout ของ Gemini API** | `src/features/admin-ai/shared/utils/geminiClientUtils.js` |
| **การอ่านไฟล์ PDF 300+ หน้า / แปลงหน้าสแกนเป็นภาพ Vision** | `src/features/admin-ai/shared/utils/pdfPipelineUtils.js` |
| **การตัดเลขข้อ / ตัด ก.ข.ค.ง. / แปลง LaTeX เป็น Unicode / Exact Match** | `src/features/admin-ai/shared/utils/examTextFormatUtils.js` |
| **การกู้คืน JSON ที่ถูกตัดกลางคัน (`MAX_TOKENS`)** | `src/features/admin-ai/shared/utils/partialJsonUtils.js` |
| **AI สร้างข้อสอบใหม่ — ปรับ Prompt หรือเงื่อนไขตรวจซ้ำ** | `src/features/admin-ai/generator/prompts/examGeneratorPrompt.js`, `utils/generatorDedupeUtils.js` |
| **AI ดึงข้อสอบจากไฟล์ — ปรับ Prompt Pass 1 / Stage 3A / Stage 3B** | `src/features/admin-ai/extractor/prompts/examExtractorPrompts.js` |
| **AI ดึงข้อสอบจากไฟล์ — อัลกอริทึมจับคู่เฉลย Pass 2 (Multi-Set)** | `src/features/admin-ai/extractor/utils/answerKeyMatchingUtils.js` |
| **AI ดึงข้อสอบจากไฟล์ — Stage 3A/3B & Auto-Fallback** | `src/features/admin-ai/extractor/services/extractorPass3Service.js` |
| **AI ดึงข้อสอบจากไฟล์ — Checkpoint / Staging Draft / Publish Guard** | `src/features/admin-ai/extractor/services/extractionCheckpointService.js`, `stagingQuestionService.js` |
| **AI ดึงข้อสอบจากไฟล์ — Modal เทียบเฉลยหนังสือ vs AI** | `src/features/admin-ai/extractor/components/OverrideReasonModal.jsx` |
| **AI ตรวจทานเฉลย — ปรับ Prompt ด่าน 1 & ด่าน 2** | `src/features/admin-ai/auditor/prompts/answerAuditorPrompts.js` |
| **AI ตรวจทานเฉลย — ด่าน 0 Local Pre-Check & คำนวณโควตา** | `src/features/admin-ai/auditor/utils/auditorLocalUtils.js` |
| **AI ตรวจทานเฉลย — Pipeline 3 ด่าน & ปุ่มอนุมัติ/คงเฉลยเดิม** | `src/features/admin-ai/auditor/services/auditorPipelineService.js`, `auditorDbService.js` |

---

## 4. รายการตรวจสอบหลังรีแฟกเตอร์ (Post-Refactor QA Checklist)

### ฝั่งผู้เข้าสอบ (Student)
- [ ] เข้าสู่ระบบ / สมัครสมาชิก / ออกจากระบบได้ตามปกติ
- [ ] หน้าแรกแสดงรายวิชาครบและตัวเลขจำนวนข้อสอบตรงตามฐานข้อมูล (>1,000 ข้อ)
- [ ] หน้าเริ่มสอบตั้งจำนวนข้อสอบได้สูงสุดตามจำนวนจริง (เกิน 1,000 ข้อ) และสลับโหมดได้ครบ
- [ ] ระบบ Auto-Save บันทึกอัตโนมัติ รีเฟรชหน้าแล้วขึ้นแจ้งเตือนกู้คืนเซสชันเดิมครบทุกข้อที่ตอบไว้
- [ ] ส่งข้อสอบแล้วแสดงผลคะแนน เฉลยรายข้อ บันทึกเข้า Analytics และส่งข้อที่ตอบผิดเข้า Mistake Bank ถูกต้อง
- [ ] หน้า Mistake Bank แสดงข้อที่ผิดและสามารถลบข้อที่ทบทวนแล้วได้
- [ ] หน้า Profile แก้ไขชื่อและเปลี่ยนรหัสผ่านได้ตามปกติ

### ฝั่งผู้ดูแลระบบ (Admin & Creator)
- [ ] สลับธีม Light / Dark Mode ได้ทุกหน้าและทุก Modal โดยสีข้อความคมชัดอ่านง่าย
- [ ] หน้าจัดการหมวดหมู่: เพิ่ม แก้ไข ซ่อน/เปิด แชร์สิทธิ์ Creator และลบหมวดหมู่ได้
- [ ] หน้าจัดการผู้ใช้ (เฉพาะ Admin): ดูรายชื่อและเปลี่ยนบทบาทได้
- [ ] หน้าจัดการคลังข้อสอบ: เพิ่ม แก้ไข อัปโหลดรูป เปลี่ยนหน้า กระโดดไปหน้า/ข้อ เรียงลำดับ และ Bulk Move/Status/Delete ได้
- [ ] นำเข้าชุดใหญ่ (วางข้อความคั่นด้วย `---`): แปลงและบันทึกแบบฉบับร่างหรือเผยแพร่ทันทีได้
- [ ] AI สร้างข้อสอบจากเอกสาร: อัปโหลด PDF/TXT สร้างข้อสอบ ตรวจแก้ในตาราง และบันทึกลงคลังได้
- [ ] AI ดึงข้อสอบจากไฟล์ (3-Pass Hybrid Extractor): อัปโหลด PDF/รูป สกัด Pass 1 → จับคู่ Pass 2 → ตรวจ Pass 3, หยุดพัก/Resume Checkpoint, เปิด Modal เทียบเฉลยหนังสือ vs AI, และเผยแพร่เข้าคลังหลักได้
- [ ] AI ตรวจทานเฉลย (AI Answer Auditor): สแกน 3 ด่าน ดูรายการ Flagged กดใช้เฉลย AI / คงเฉลยเดิม / แก้ไขเอง และอนุมัติแบบกลุ่มได้
- [ ] หน้าตั้งค่า AI: บันทึก Gemini API Key และเลือกโมเดลเริ่มต้นได้

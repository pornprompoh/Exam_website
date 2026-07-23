import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import CategoryManager from './pages/admin/CategoryManager'
import QuestionManager from './pages/admin/QuestionManager'
import Home from './pages/user/Home'
import ExamSession from './pages/user/ExamSession'
import MistakeBank from './pages/user/MistakeBank' // 1. Import ตรงนี้

function AdminLayout() {
  const [activeTab, setActiveTab] = useState('categories')
  return (
    <div className="min-h-screen bg-slate-100 py-8 font-sans">
      <nav className="max-w-4xl mx-auto px-6 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="font-bold text-lg text-indigo-600 flex items-center gap-2">
          ⚡ Exam Website <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Admin Panel</span>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          <button onClick={() => setActiveTab('categories')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${activeTab === 'categories' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>📁 จัดการหมวดหมู่วิชา</button>
          <button onClick={() => setActiveTab('questions')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${activeTab === 'questions' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>📝 จัดการคลังข้อสอบ</button>
        </div>
      </nav>
      {activeTab === 'categories' ? <CategoryManager /> : <QuestionManager />}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/exam/:categoryId" element={<ExamSession />} />
        
        {/* 2. เพิ่ม Route คลังข้อผิดตรงนี้ */}
        <Route path="/mistakes" element={<MistakeBank />} />

        <Route path="/admin" element={<AdminLayout />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
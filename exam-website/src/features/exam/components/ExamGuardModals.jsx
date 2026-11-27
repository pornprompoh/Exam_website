import ConfirmModal from '../../../shared/components/ConfirmModal'

export default function ExamGuardModals({
  answeredCount,
  unansweredCount,
  questionsLength,
  showExitZeroModal,
  onCloseExitZero,
  onConfirmExitZero,
  showExitProgressModal,
  onCloseExitProgress,
  onConfirmExitProgress,
  showZeroSubmitModal,
  onCloseZeroSubmit,
  showPartialSubmitModal,
  onClosePartialSubmit,
  onConfirmPartialSubmit,
  showTimeOutModal,
  onCloseTimeOut
}) {
  return (
    <>
      <ConfirmModal
        isOpen={showExitZeroModal}
        type="warning"
        title="คุณยังไม่ได้ทำข้อสอบเลย ต้องการออกจากห้องสอบใช่หรือไม่?"
        description="หากกดยืนยันออก ระบบจะล้างรอบนี้ทิ้งโดยไม่บันทึกประวัติใดๆ ลงสถิติหรือคลังข้อผิดพลาดครับ"
        cancelText="← ไม่ออก / ทำต่อ"
        confirmText="🚪 ยืนยันออก"
        onClose={onCloseExitZero}
        onConfirm={onConfirmExitZero}
      />

      <ConfirmModal
        isOpen={showExitProgressModal}
        type="info"
        title="พักการทำข้อสอบและกลับหน้าหลักใช่หรือไม่?"
        description={
          <>
            คุณทำไปแล้ว <strong className="text-teal-600 font-mono text-sm sm:text-base">{answeredCount.toLocaleString()}</strong> / {questionsLength.toLocaleString()} ข้อ<br />
            ระบบได้บันทึกความคืบหน้า (Auto-Save 7 วัน) และ<strong className="text-slate-900">หยุดเวลาที่เหลือไว้ให้แล้ว</strong> คุณสามารถกลับมาทำต่อจากเดิมได้ทุกเมื่อครับ
          </>
        }
        cancelText="← ทำข้อสอบต่อ"
        confirmText="💾 พักไว้แล้วกลับหน้าหลัก"
        onClose={onCloseExitProgress}
        onConfirm={onConfirmExitProgress}
      />

      <ConfirmModal
        isOpen={showZeroSubmitModal}
        type="warning"
        title="ยังส่งข้อสอบไม่ได้!"
        description="กรุณาทำข้อสอบอย่างน้อย 1 ข้อก่อนส่งคำตอบครับ"
        confirmText="✨ เข้าใจแล้ว กลับไปทำข้อสอบ"
        cancelText=""
        onConfirm={onCloseZeroSubmit}
        onClose={onCloseZeroSubmit}
      />

      <ConfirmModal
        isOpen={showPartialSubmitModal}
        type="warning"
        title="ยืนยันส่งข้อสอบเลยใช่หรือไม่?"
        description={
          <>
            ทำไปแล้ว <strong className="text-teal-700 font-mono">{answeredCount.toLocaleString()} / {questionsLength.toLocaleString()} ข้อ</strong> — ยังมีข้อที่ยังไม่ได้ทำอีก{' '}
            <strong className="text-amber-700 font-mono">{unansweredCount.toLocaleString()} ข้อ</strong><br />
            ข้อที่ยังไม่ได้ทำจะ<strong>ไม่แสดงเฉลย</strong>และ<strong>ไม่ถูกเก็บเข้าคลังข้อผิดพลาด</strong> ต้องการส่งข้อสอบเลยหรือไม่?
          </>
        }
        cancelText="← กลับไปทำต่อ"
        confirmText="🚀 ยืนยันส่งข้อสอบเลย"
        onClose={onClosePartialSubmit}
        onConfirm={onConfirmPartialSubmit}
      />

      <ConfirmModal
        isOpen={showTimeOutModal}
        type="info"
        title="⏳ หมดเวลาทำข้อสอบแล้ว!"
        description="ระบบได้ส่งคำตอบที่คุณทำไว้เรียบร้อยแล้ว ข้อที่เว้นว่างจะถูกซ่อนเฉลยและไม่เก็บเข้าคลังข้อผิดพลาดครับ"
        confirmText="💡 ดูผลคะแนนและเฉลย"
        cancelText=""
        onConfirm={onCloseTimeOut}
        onClose={onCloseTimeOut}
      />
    </>
  )
}

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
        title="คุณยังไม่ได้ทำข้อสอบ ต้องการออกจากห้องสอบใช่หรือไม่?"
        description="หากยืนยันออก ระบบจะล้างรอบนี้โดยไม่บันทึกประวัติลงสถิติหรือคลังข้อผิดพลาด"
        cancelText="ทำข้อสอบต่อ"
        confirmText="ยืนยันออกจากห้องสอบ"
        onClose={onCloseExitZero}
        onConfirm={onConfirmExitZero}
      />

      <ConfirmModal
        isOpen={showExitProgressModal}
        type="info"
        title="พักการทำข้อสอบและกลับหน้าหลักใช่หรือไม่?"
        description={
          <>
            คุณทำไปแล้ว{' '}
            <strong className="text-indigo-600 dark:text-indigo-400 font-mono tabular-nums font-semibold">
              {answeredCount.toLocaleString()}
            </strong>{' '}
            / <span className="font-mono tabular-nums">{questionsLength.toLocaleString()}</span> ข้อ
            <br />
            ระบบบันทึกความคืบหน้าอัตโนมัติ (7 วัน) และ{' '}
            <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">หยุดเวลาที่เหลือไว้ให้แล้ว</strong>{' '}
            สามารถกลับมาทำต่อจากเดิมได้ทุกเมื่อ
          </>
        }
        cancelText="ทำข้อสอบต่อ"
        confirmText="พักไว้แล้วกลับหน้าหลัก"
        onClose={onCloseExitProgress}
        onConfirm={onConfirmExitProgress}
      />

      <ConfirmModal
        isOpen={showZeroSubmitModal}
        type="warning"
        title="ยังส่งข้อสอบไม่ได้"
        description="กรุณาทำข้อสอบอย่างน้อย 1 ข้อก่อนส่งคำตอบ"
        confirmText="กลับไปทำข้อสอบ"
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
            ทำไปแล้ว{' '}
            <strong className="text-indigo-600 dark:text-indigo-400 font-mono tabular-nums font-semibold">
              {answeredCount.toLocaleString()} / {questionsLength.toLocaleString()} ข้อ
            </strong>{' '}
            และยังเว้นว่างอีก{' '}
            <strong className="text-amber-600 dark:text-amber-400 font-mono tabular-nums font-semibold">
              {unansweredCount.toLocaleString()} ข้อ
            </strong>
            <br />
            ข้อที่ยังไม่ได้ทำจะ<strong className="text-zinc-900 dark:text-zinc-100 font-semibold">ไม่แสดงเฉลย</strong>และ
            <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">ไม่ถูกเก็บเข้าคลังข้อผิดพลาด</strong>{' '}
            ต้องการส่งข้อสอบเลยหรือไม่?
          </>
        }
        cancelText="กลับไปทำต่อ"
        confirmText="ยืนยันส่งข้อสอบเลย"
        onClose={onClosePartialSubmit}
        onConfirm={onConfirmPartialSubmit}
      />

      <ConfirmModal
        isOpen={showTimeOutModal}
        type="info"
        title="หมดเวลาทำข้อสอบแล้ว"
        description="ระบบส่งคำตอบที่คุณทำไว้เรียบร้อยแล้ว ข้อที่เว้นว่างจะถูกซ่อนเฉลยและไม่เก็บเข้าคลังข้อผิดพลาด"
        confirmText="ดูผลคะแนนและเฉลย"
        cancelText=""
        onConfirm={onCloseTimeOut}
        onClose={onCloseTimeOut}
      />
    </>
  )
}

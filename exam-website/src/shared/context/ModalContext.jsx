/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'

const ModalContext = createContext(null)

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'ตกลง',
    cancelText: 'ยกเลิก',
    type: 'info',
    theme: undefined,
    onConfirm: () => {}
  })

  const showModal = ({
    title = 'แจ้งเตือน',
    description = '',
    confirmText = 'ตกลง',
    cancelText = 'ยกเลิก',
    type = 'info',
    theme,
    onConfirm = () => {}
  }) => {
    setModalState({
      isOpen: true,
      title,
      description,
      confirmText,
      cancelText,
      type,
      theme,
      onConfirm
    })
  }

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }))
  }

  return (
    <ModalContext.Provider value={{ showModal, closeModal }}>
      {children}
      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        description={modalState.description}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        type={modalState.type}
        theme={modalState.theme}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
      />
    </ModalContext.Provider>
  )
}

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal ต้องถูกใช้งานภายใน <ModalProvider /> เท่านั้น')
  }
  return context
}

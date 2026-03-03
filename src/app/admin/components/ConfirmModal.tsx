'use client'

import React, { useEffect, useRef, useCallback } from 'react'

export interface ConfirmModalProps {
  open: boolean
  title: string
  description: string
  /** When set, a text input is shown and confirm is disabled until it matches (min length). */
  requiredInput?: { placeholder: string; minLength: number; label?: string }
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: (value?: string) => void
  onCancel: () => void
}

/** Accessible confirm modal with optional required text input. Replaces confirm() and window.prompt(). */
export function ConfirmModal({
  open,
  title,
  description,
  requiredInput,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = React.useState('')
  const canConfirm = !requiredInput || (inputValue.trim().length >= requiredInput.minLength)

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return
    onConfirm(requiredInput ? inputValue.trim() : undefined)
    setInputValue('')
  }, [canConfirm, requiredInput, inputValue, onConfirm])

  const handleCancel = useCallback(() => {
    setInputValue('')
    onCancel()
  }, [onCancel])

  useEffect(() => {
    if (!open) return
    setInputValue('')
    const el = dialogRef.current
    if (!el) return
    const focusables = Array.from(
      el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((e) => !e.hasAttribute('disabled'))
    const first = requiredInput ? inputRef.current : focusables[0]
    first?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
        return
      }
      if (e.key !== 'Tab') return
      const current = document.activeElement
      const idx = focusables.indexOf(current as HTMLElement)
      if (idx === -1) return
      if (e.shiftKey) {
        if (idx === 0) {
          e.preventDefault()
          focusables[focusables.length - 1]?.focus()
        }
      } else {
        if (idx === focusables.length - 1) {
          e.preventDefault()
          focusables[0]?.focus()
        }
      }
    }
    el.addEventListener('keydown', handleKey)
    return () => el.removeEventListener('keydown', handleKey)
  }, [open, requiredInput, handleCancel])

  if (!open) return null

  const isDanger = variant === 'danger'

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="bg-[var(--surface)] rounded-2xl max-w-md w-full shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 id="confirm-modal-title" className="text-lg font-semibold text-[var(--text)] mb-2">
            {title}
          </h2>
          <p id="confirm-modal-desc" className="text-sm text-[var(--text-muted)] mb-4">
            {description}
          </p>
          {requiredInput && (
            <div className="mb-4">
              {requiredInput.label && (
                <label htmlFor="confirm-modal-input" className="block text-sm font-medium text-[var(--text)] mb-1">
                  {requiredInput.label}
                </label>
              )}
              <input
                id="confirm-modal-input"
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={requiredInput.placeholder}
                className="input-field w-full"
                aria-required="true"
                aria-invalid={inputValue.trim().length > 0 && inputValue.trim().length < requiredInput.minLength}
              />
              {requiredInput.minLength > 0 && (
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Minimum {requiredInput.minLength} characters
                </p>
              )}
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-hover)]"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={
                isDanger
                  ? 'px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'px-4 py-2 rounded-lg bg-[var(--accent-purple)] text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
              }
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

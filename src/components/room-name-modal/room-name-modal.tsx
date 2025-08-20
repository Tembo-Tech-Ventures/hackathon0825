'use client'

import { useEffect, useState } from 'react'

interface RoomNameModalProps {
  title?: string
  defaultValue?: string
  submitLabel?: string
  onSubmit: (name: string) => void
  onCancel: () => void
}

export function RoomNameModal({
  title = 'Set Room Name',
  defaultValue = '',
  submitLabel = 'Save',
  onSubmit,
  onCancel,
}: RoomNameModalProps) {
  const [name, setName] = useState<string>(defaultValue)

  useEffect(() => {
    setName(defaultValue)
  }, [defaultValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) {
      onSubmit(trimmed)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-chat-sidebar rounded-lg p-6 max-w-md w-full mx-4 animate-slide-up border border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-md hover:bg-gray-700 text-gray-300"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter room name"
            className="chat-input"
            autoFocus
            maxLength={100}
            required
          />

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="chat-button px-4 py-2"
              disabled={name.trim().length === 0}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

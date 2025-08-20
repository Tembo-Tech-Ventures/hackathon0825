'use client'

import { useState } from 'react'

interface UsernameModalProps {
  onSubmit: (username: string) => void
}

export function UsernameModal({ onSubmit }: UsernameModalProps) {
  const [username, setUsername] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim()) {
      onSubmit(username.trim())
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-chat-sidebar rounded-lg p-8 max-w-md w-full mx-4 animate-slide-up">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to Chat</h2>
          <p className="text-gray-400">Enter your username to start chatting</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="chat-input"
              autoFocus
              maxLength={50}
              required
            />
          </div>
          
          <button
            type="submit"
            className="chat-button w-full"
            disabled={username.trim().length === 0}
          >
            Start Chatting, {username}
          </button>
        </form>
      </div>
    </div>
  )
}

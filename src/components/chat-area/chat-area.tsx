'use client'

import { useState, useRef, useEffect } from 'react'
import { Message } from '@/types'
import { formatTime, formatDate } from '@/lib/utils'

interface ChatAreaProps {
  messages: Message[]
  currentRoomName: string
  username: string
  onSendMessage: (content: string) => Promise<void>
  isLoading?: boolean
  onRenameRoom?: () => void
}

export function ChatArea({
  messages,
  currentRoomName,
  username,
  onSendMessage,
  isLoading = false,
  onRenameRoom,
}: ChatAreaProps) {
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    } else {
      // Fallback
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isSending) return

    const content = inputValue.trim()
    setInputValue('')
    setIsSending(true)

    try {
      await onSendMessage(content)
    } catch (error) {
      console.error('Failed to send message:', error)
      setInputValue(content) // Restore the message on error
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [inputValue])

  const groupedMessages = messages.reduce((groups: { date: string; messages: Message[] }[], message) => {
    const messageDate = formatDate(new Date(message.createdAt))
    const lastGroup = groups[groups.length - 1]

    if (lastGroup && lastGroup.date === messageDate) {
      lastGroup.messages.push(message)
    } else {
      groups.push({ date: messageDate, messages: [message] })
    }

    return groups
  }, [])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="bg-chat-sidebar border-b border-gray-700 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-white truncate">{currentRoomName}</h2>
          {onRenameRoom && (
            <button
              onClick={onRenameRoom}
              className="p-2 rounded-md hover:bg-gray-700 text-gray-300"
              title="Rename room"
              aria-label="Rename room"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-gray-400 text-sm">{messages.length} messages</p>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
        {groupedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Start the conversation</h3>
              <p className="text-gray-400">Send a message to begin chatting in {currentRoomName}</p>
            </div>
          </div>
        ) : (
          <div className="py-4">
            {groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="bg-chat-message px-3 py-1 rounded-full">
                    <span className="text-gray-400 text-sm font-medium">{group.date}</span>
                  </div>
                </div>

                {/* Messages for this date */}
                {group.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message-bubble ${
                      message.username === username ? 'user-message' : 'assistant-message'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-medium text-sm">
                          {message.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-white">{message.username}</span>
                          <span className="text-gray-400 text-sm">
                            {formatTime(new Date(message.createdAt))}
                          </span>
                        </div>
                        <div className="text-gray-100 whitespace-pre-wrap break-words">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700 p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${currentRoomName}...`}
                className="chat-input min-h-[44px] max-h-[200px]"
                disabled={isSending}
                rows={1}
              />
            </div>
            <button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className="chat-button flex items-center gap-2 px-6"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

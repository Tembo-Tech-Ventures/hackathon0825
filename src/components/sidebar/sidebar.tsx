'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ChatRoom {
  id: string
  name: string
  createdAt: Date
}

interface SidebarProps {
  chatRooms: ChatRoom[]
  currentRoomId: string | null
  onRoomSelect: (roomId: string) => void
  onNewRoom: () => void
  username: string
  onUsernameChange: () => void
}

export function Sidebar({
  chatRooms,
  currentRoomId,
  onRoomSelect,
  onNewRoom,
  username,
  onUsernameChange,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-chat-sidebar p-2 rounded-lg border border-gray-700"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className={cn(
        "bg-chat-sidebar border-r border-gray-700 flex flex-col transition-all duration-300",
        "fixed lg:relative inset-y-0 left-0 z-50",
        isCollapsed ? "w-16" : "w-80",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-white">Chat Rooms</h1>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg
              className={cn("w-5 h-5 text-gray-400 transition-transform", isCollapsed && "rotate-180")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* New Chat Button */}
      {!isCollapsed && (
        <div className="p-4">
          <button
            onClick={onNewRoom}
            className="w-full flex items-center gap-3 p-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-medium">New Chat</span>
          </button>
        </div>
      )}

      {/* Chat Rooms List */}
      <div className="flex-1 overflow-y-auto">
        {!isCollapsed && (
          <div className="p-2">
            {chatRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => onRoomSelect(room.id)}
                className={cn(
                  "sidebar-item w-full text-left",
                  currentRoomId === room.id && "bg-primary-600/20 border-r-2 border-primary-500"
                )}
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{room.name}</div>
                  <div className="text-gray-400 text-sm">
                    {new Date(room.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User Info */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onUsernameChange}
            className="sidebar-item w-full"
          >
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium truncate">{username}</div>
              <div className="text-gray-400 text-sm">Click to change</div>
            </div>
          </button>
        </div>
      )}
      </div>
    </>
  )
}

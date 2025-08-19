'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Sidebar } from '@/components/sidebar/sidebar'
import { ChatArea } from '@/components/chat-area/chat-area'
import { UsernameModal } from '@/components/username-modal/username-modal'
import { getChatRooms, getMessages, sendMessage, createChatRoom, getChatRoom } from './actions'
import { ChatRoom, Message } from '@/types'

const fetcher = async (url: string) => {
  const [action, ...params] = url.split('/')
  
  switch (action) {
    case 'chatRooms':
      const roomsResult = await getChatRooms()
      return roomsResult.success ? roomsResult.chatRooms : []
    case 'messages':
      const messagesResult = await getMessages(params[0])
      return messagesResult.success ? messagesResult.messages : []
    default:
      throw new Error('Unknown action')
  }
}

export default function HomePage() {
  const [username, setUsername] = useState<string | null>(null)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const [currentRoomName, setCurrentRoomName] = useState<string>('')

  // Load username from localStorage on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('chatapp-username')
    if (savedUsername) {
      setUsername(savedUsername)
    }
  }, [])

  // Fetch chat rooms
  const { data: chatRooms = [], mutate: mutateChatRooms } = useSWR<ChatRoom[]>(
    'chatRooms',
    fetcher,
    {
      refreshInterval: 5000, // Poll every 5 seconds
      revalidateOnFocus: true,
    }
  )

  // Fetch messages for current room
  const { data: messages = [], mutate: mutateMessages } = useSWR<Message[]>(
    currentRoomId ? `messages/${currentRoomId}` : null,
    fetcher,
    {
      refreshInterval: 2000, // Poll every 2 seconds for messages
      revalidateOnFocus: true,
    }
  )

  // Set initial room if none selected
  useEffect(() => {
    if (!currentRoomId && chatRooms.length > 0) {
      handleRoomSelect(chatRooms[0].id)
    }
  }, [chatRooms, currentRoomId])

  const handleUsernameSubmit = (newUsername: string) => {
    setUsername(newUsername)
    localStorage.setItem('chatapp-username', newUsername)
  }

  const handleUsernameChange = () => {
    setUsername(null)
    localStorage.removeItem('chatapp-username')
  }

  const handleRoomSelect = async (roomId: string) => {
    setCurrentRoomId(roomId)
    
    // Get room name
    const roomResult = await getChatRoom(roomId)
    if (roomResult.success) {
      setCurrentRoomName(roomResult.chatRoom!.name)
    }
  }

  const handleNewRoom = async () => {
    const roomName = `Chat Room ${chatRooms.length + 1}`
    const result = await createChatRoom(roomName)
    
    if (result.success) {
      await mutateChatRooms()
      handleRoomSelect(result.chatRoom!.id)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!currentRoomId || !username) return

    const result = await sendMessage(currentRoomId, username, content)
    
    if (result.success) {
      // Optimistically update messages
      await mutateMessages()
      // Update chat rooms to reflect new activity
      await mutateChatRooms()
    } else {
      throw new Error(result.error)
    }
  }

  // Show username modal if no username is set
  if (!username) {
    return <UsernameModal onSubmit={handleUsernameSubmit} />
  }

  // Show loading state if no rooms are loaded yet
  if (chatRooms.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading chat rooms...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar
        chatRooms={chatRooms}
        currentRoomId={currentRoomId}
        onRoomSelect={handleRoomSelect}
        onNewRoom={handleNewRoom}
        username={username}
        onUsernameChange={handleUsernameChange}
      />
      
      <div className="flex-1 flex flex-col lg:ml-0">
        {currentRoomId ? (
          <ChatArea
            messages={messages}
            currentRoomName={currentRoomName}
            username={username}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-primary-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Select a chat room</h3>
              <p className="text-gray-400 text-sm">Choose a room from the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

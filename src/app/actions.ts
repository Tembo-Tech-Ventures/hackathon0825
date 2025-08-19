'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function createChatRoom(name: string) {
  try {
    const chatRoom = await prisma.chatRoom.create({
      data: {
        name: name.trim(),
      },
    })
    
    revalidatePath('/')
    return { success: true, chatRoom }
  } catch (error) {
    console.error('Failed to create chat room:', error)
    return { success: false, error: 'Failed to create chat room' }
  }
}

export async function getChatRooms() {
  try {
    const chatRooms = await prisma.chatRoom.findMany({
      orderBy: {
        updatedAt: 'desc',
      },
    })
    
    return { success: true, chatRooms }
  } catch (error) {
    console.error('Failed to fetch chat rooms:', error)
    return { success: false, error: 'Failed to fetch chat rooms', chatRooms: [] }
  }
}

export async function getMessages(chatRoomId: string) {
  try {
    const messages = await prisma.message.findMany({
      where: {
        chatRoomId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })
    
    return { success: true, messages }
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    return { success: false, error: 'Failed to fetch messages', messages: [] }
  }
}

export async function sendMessage(chatRoomId: string, username: string, content: string) {
  try {
    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        username: username.trim(),
        chatRoomId,
      },
    })
    
    // Update the chat room's updatedAt timestamp
    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { updatedAt: new Date() },
    })
    
    revalidatePath('/')
    return { success: true, message }
  } catch (error) {
    console.error('Failed to send message:', error)
    return { success: false, error: 'Failed to send message' }
  }
}

export async function getChatRoom(chatRoomId: string) {
  try {
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
    })
    
    if (!chatRoom) {
      return { success: false, error: 'Chat room not found' }
    }
    
    return { success: true, chatRoom }
  } catch (error) {
    console.error('Failed to fetch chat room:', error)
    return { success: false, error: 'Failed to fetch chat room' }
  }
}

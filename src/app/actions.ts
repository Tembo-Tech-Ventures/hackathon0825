'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import '@cerebras/cerebras_cloud_sdk/shims/web'
import Cerebras from '@cerebras/cerebras_cloud_sdk'

const BOT_USERNAME = 'Cerebras Bot'
const cerebrasClient = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY,
})

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
    
    // Determine if we should invoke AI
    const keywordTrigger = /\b(ai|bot|assistant|gpt|cerebras)\b/i.test(content)
    let shouldInvokeAI = keywordTrigger

    // If no keyword trigger, but previous message was from the bot, classify if this is a reply to the AI
    if (!shouldInvokeAI && process.env.CEREBRAS_API_KEY) {
      const recentTwo = await prisma.message.findMany({
        where: { chatRoomId },
        orderBy: { createdAt: 'desc' },
        take: 2,
      })
      const prev = recentTwo.find((m: { id: string; username: string; content: string }) => m.id !== message.id)
      if (prev && prev.username === BOT_USERNAME) {
        try {
          const classify = await cerebrasClient.chat.completions.create({
            model: 'llama3.1-8b',
            messages: [
              {
                role: 'system',
                content:
                  'You are a classifier. Decide if the USER message is a direct response to the ASSISTANT message. Reply with ONLY "YES" or "NO" with no punctuation.',
              },
              {
                role: 'user',
                content: `ASSISTANT: ${prev.content}\nUSER: ${content}\nIs the USER replying to the ASSISTANT?`,
              },
            ],
          })
          const cls: any = classify
          const decision = String(cls?.choices?.[0]?.message?.content ?? '')
            .trim()
            .toUpperCase()
          if (decision.startsWith('Y')) {
            shouldInvokeAI = true
          }
        } catch (aiErr) {
          console.error('AI reply-classification failed:', aiErr)
        }
      }
    }

    if (shouldInvokeAI && process.env.CEREBRAS_API_KEY) {
      try {
        // Fetch last 10 messages for context (most recent first), then reverse to chronological order
        const recent = await prisma.message.findMany({
          where: { chatRoomId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
        const history = recent.reverse()

        // Build chat history for Cerebras
        const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          {
            role: 'system',
            content:
              'You are a helpful assistant in a small team chat app. Be concise and directly answer the latest user message. If context is ambiguous, ask a brief clarifying question. Do not include your name or any speaker label in your replies; respond with the message content only.',
          },
          ...history.map((m: { username: string; content: string }) => ({
            role: m.username === BOT_USERNAME ? 'assistant' : 'user',
            content: m.content,
          })),
        ]

        const completion = await cerebrasClient.chat.completions.create({
          messages: chatMessages,
          model: 'llama3.1-8b',
        })

        const aiText = (completion?.choices?.[0]?.message as any)?.content as string | undefined
        if (aiText && aiText.trim()) {
          // Strip any accidental speaker prefixes like "Cerebras Bot:" or "Assistant:"
          const cleaned = aiText
            .trim()
            .replace(/^(cerebras\s*bot|assistant)\s*:\s*/i, '')
          await prisma.message.create({
            data: {
              content: cleaned,
              username: BOT_USERNAME,
              chatRoomId,
            },
          })
          // Touch room timestamp
          await prisma.chatRoom.update({
            where: { id: chatRoomId },
            data: { updatedAt: new Date() },
          })
        }
      } catch (aiError) {
        console.error('Failed to generate AI response:', aiError)
      }
    }

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

export async function renameChatRoom(chatRoomId: string, name: string) {
  try {
    const trimmed = name.trim()
    if (!trimmed) {
      return { success: false, error: 'Name cannot be empty' }
    }

    const chatRoom = await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { name: trimmed },
    })

    revalidatePath('/')
    return { success: true, chatRoom }
  } catch (error) {
    console.error('Failed to rename chat room:', error)
    return { success: false, error: 'Failed to rename chat room' }
  }
}



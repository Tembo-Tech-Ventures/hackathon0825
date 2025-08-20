'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import '@cerebras/cerebras_cloud_sdk/shims/web'
import Cerebras from '@cerebras/cerebras_cloud_sdk'
import { withRetry } from '@/lib/retry'
import { tavilySearch } from '@/lib/tavily'

const BOT_USERNAME = 'Cerebras Bot'
const cerebrasClient = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY,
})

function heuristicsNeedsSearch(message: string): boolean {
  const text = message.toLowerCase()
  const strongIndicators = [
    'source',
    'sources',
    'cite',
    'citation',
    'reference',
    'references',
    'link',
    'links',
    'url',
    'article',
    'articles',
    'blog',
    'blogs',
    'paper',
    'papers',
    'study',
    'studies',
    'news',
    'report',
    'reports',
    'case study',
    'case studies',
    'best practices',
    'whitepaper',
    'reading list',
    'resources',
    'docs',
    'documentation',
    // extra liberal signals
    'guides',
    'playbook',
  ]
  const timeSensitiveIndicators = [
    'latest',
    'current',
    'today',
    'this week',
    'recent',
    'recently',
    'update',
    'updates',
    'trending',
    'these days',
    'currently',
    'right now',
    '2024',
    '2025',
  ]
  const domainSignals = [
    'industry',
    'market',
    'landscape',
    'state of',
    'overview',
    'benchmark',
    'benchmarks',
  ]
  const questionyIndicators = [
    'what',
    'how',
    'when',
    'where',
    'who',
    'which',
    'list',
    'top',
    'best',
    'examples',
    'how to',
    'according to',
  ]
  const hasStrong = strongIndicators.some((s) => text.includes(s))
  const hasTimeSensitive = timeSensitiveIndicators.some((s) => text.includes(s))
  const hasDomain = domainSignals.some((s) => text.includes(s))
  const isQuestiony = questionyIndicators.some((q) => text.includes(q)) || /\?$/.test(message.trim())
  return hasStrong || hasTimeSensitive || (hasDomain && isQuestiony)
}

async function classifyNeedsSearch(message: string): Promise<boolean> {
  // Fast path: heuristics only
  if (heuristicsNeedsSearch(message)) {
    console.log('classifyNeedsSearch: heuristic -> YES', { inputSnippet: message.slice(0, 120) })
    return true
  }

  if (!process.env.CEREBRAS_API_KEY) {
    console.warn('classifyNeedsSearch: CEREBRAS_API_KEY missing; skipping search classification')
    return false
  }
  try {
    const classify = await withRetry(() =>
      cerebrasClient.chat.completions.create({
        model: 'llama3.1-8b',
        messages: [
          {
            role: 'system',
            content:
              'You are a classifier that errs on the side of using external web search. Reply YES if external factual lookup, recent information, examples, articles, sources, best practices, or references would improve answer quality. Reply NO only if the message is clearly opinion, chit-chat, or can be answered confidently without web context. Reply with ONLY "YES" or "NO".',
          },
          { role: 'user', content: message },
        ],
      })
    )
    const cls: any = classify
    const decision = String(cls?.choices?.[0]?.message?.content ?? '')
      .trim()
      .toUpperCase()
    console.log('classifyNeedsSearch (LLM):', {
      decision,
      inputSnippet: message.slice(0, 120),
    })
    return decision.startsWith('Y')
  } catch (e) {
    console.error('Search classification failed:', e)
    return false
  }
}

// Detect if a query is time-sensitive (should bias to recent updates)
function isTimeSensitiveQuery(message: string): boolean {
  const t = message.toLowerCase()
  return (
    /\b(latest|current|today|this week|recent|recently|update|updates|trending|breaking|these days|right now)\b/.test(t) ||
    /\b20\d{2}\b/.test(t) ||
    /\b(past|last)\s+\d+\s+(days|day|weeks|week|months|month)\b/.test(t)
  )
}

// Build a search-oriented query, optionally biasing toward recency
function buildSearchQuery(original: string): { query: string; timeSensitive: boolean } {
  const trimmed = original.replace(/^\s*(bot|ai)\s*[:,]?\s*/i, '').trim()
  const timeSensitive = isTimeSensitiveQuery(trimmed)
  if (timeSensitive) {
    // Nudge Tavily toward recency via phrasing
    const q = `${trimmed} recent notable developments last 21 days`
    return { query: q, timeSensitive }
  }
  return { query: trimmed, timeSensitive }
}

function buildSourcesMarkdown(results: Array<{ title?: string | null; url: string }>, images: string[]): string {
  const lines: string[] = []
  if (results.length) {
    lines.push('Sources:')
    results.slice(0, 5).forEach((r, i) => {
      const title = r.title?.trim() || r.url
      lines.push(`- [${i + 1}] ${title} (${r.url})`)
    })
  }
  if (images && images.length) {
    const top = images.slice(0, 3)
    lines.push('', 'Images:')
    const mdLine = top.map((u, i) => `![Image ${i + 1}](${u})`).join(' ')
    lines.push(mdLine)
  }
  return lines.join('\n')
}

type SearchResult = { title?: string | null; url: string; content?: string | null; score?: number | null; favicon?: string | null }

function rankSearchResults(results: SearchResult[], timeSensitive: boolean): SearchResult[] {
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec']
  const authorityHosts = ['reuters.com', 'apnews.com', 'bbc.com', 'nytimes.com', 'ft.com', 'theguardian.com', 'aljazeera.com', 'wsj.com', 'bloomberg.com']
  const nowYear = new Date().getFullYear()
  const yearRegex = /\b(20\d{2})\b/

  function host(u: string): string {
    try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' }
  }

  function recencyBoost(r: SearchResult): number {
    const url = r.url || ''
    const snippet = (r.content || '').toLowerCase()
    let boost = 0
    const m = url.match(yearRegex) || snippet.match(yearRegex)
    if (m) {
      const y = parseInt(m[1], 10)
      if (!isNaN(y)) {
        const diff = nowYear - y
        if (diff <= 0) boost += 1.0
        else if (diff === 1) boost += 0.8
        else if (diff === 2) boost += 0.5
      }
    }
    if (monthNames.some((mn) => snippet.includes(mn))) boost += 0.4
    if (/\b(hours?|days?)\s+ago\b/.test(snippet)) boost += 0.6
    return boost
  }

  function authorityBoost(r: SearchResult): number {
    const h = host(r.url)
    return authorityHosts.some((a) => h.endsWith(a)) ? 0.5 : 0
  }

  return results
    .map((r) => {
      const base = typeof r.score === 'number' ? r.score : 0
      const extra = (timeSensitive ? recencyBoost(r) : 0) + authorityBoost(r)
      return { r, s: base + extra }
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.r)
}

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
    console.log('sendMessage: user message created', {
      id: message.id,
      chatRoomId,
      username,
      contentSnippet: content.slice(0, 200),
    })
    // Update the chat room's updatedAt timestamp
    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { updatedAt: new Date() },
    })
    
    // Determine if we should invoke AI
    const keywordTrigger = /\b(ai|bot|assistant|gpt|cerebras)\b/i.test(content)
    const heuristicInvoke = heuristicsNeedsSearch(content) || /\?\s*$/.test(content.trim())
    let shouldInvokeAI = keywordTrigger || heuristicInvoke
    console.log('sendMessage: initial AI invocation check', { keywordTrigger, heuristicInvoke })

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

    console.log('sendMessage: shouldInvokeAI final', { keywordTrigger, heuristicInvoke, shouldInvokeAI })
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
              'You are a helpful assistant in a small team chat app. Answer succinctly without any preamble or meta-commentary (avoid phrases like "in our conversation" or "I don\'t see"). If sources are provided, ground your answer in them and do not fabricate citations. Prefer listing 3–6 concise bullet points with specific facts and dates when relevant, then a 1–2 sentence synthesis. Cite claims inline using [n] matching the numbered sources. Do not include your name or any speaker label in your replies; respond with the message content only.',
          },
          ...history.map((m: { username: string; content: string }) => ({
            role: (m.username === BOT_USERNAME ? 'assistant' : 'user') as 'assistant' | 'user',
            content: m.content,
          })),
        ]

        // Determine if this needs factual search and enrich context
        let sourcesMd = ''
        let searchQueryId: string | null = null
        const needsSearch = await classifyNeedsSearch(content)
        console.log('sendMessage: needsSearch', { needsSearch })
        if (needsSearch) {
          try {
            const built = buildSearchQuery(content)
            console.log('sendMessage: invoking tavilySearch', { query: built.query, timeSensitive: built.timeSensitive })
            const search = await tavilySearch(built.query, {
              includeImages: true,
              includeAnswer: true,
              maxResults: 8,
              searchDepth: built.timeSensitive ? 'advanced' : 'basic',
            })
            // Rank results with recency/authority boost when time-sensitive
            const sortedResults = rankSearchResults(search.results ?? [], built.timeSensitive)
            console.log('sendMessage: tavilySearch results', { results: sortedResults.length || 0, images: search.images?.length || 0, ranked: true })
            // Persist search
            const sq = await prisma.searchQuery.create({
              data: {
                chatRoomId,
                initiatingMessageId: message.id,
                query: search.query,
              },
            })
            searchQueryId = sq.id
            if (sortedResults.length) {
              const createdResults = await prisma.searchResult.createMany({
                data: sortedResults.slice(0, 8).map((r) => ({
                  searchQueryId: sq.id,
                  title: r.title ?? '',
                  url: r.url,
                  snippet: r.content ?? null,
                  score: typeof r.score === 'number' ? r.score : null,
                  favicon: r.favicon ?? null,
                })),
              })
              console.log('sendMessage: persisted search results', { count: createdResults.count })
            } else {
              console.log('sendMessage: no search results returned')
            }
            if (search.images?.length) {
              const createdImages = await prisma.searchImage.createMany({
                data: search.images.slice(0, 6).map((u) => ({
                  searchQueryId: sq.id,
                  url: u,
                })),
              })
              console.log('sendMessage: persisted search images', { count: createdImages.count })
            } else {
              console.log('sendMessage: no search images returned')
            }
            sourcesMd = buildSourcesMarkdown(sortedResults.map((r) => ({ title: r.title, url: r.url })), search.images ?? [])
            console.log('sendMessage: sources markdown built', { hasSources: Boolean(sourcesMd), length: sourcesMd.length })
            // Provide brief context to model
            if (sortedResults.length) {
              const contextBlock = sortedResults
                .slice(0, 5)
                .map((r, i) => `Source [${i + 1}]: ${r.title}\nURL: ${r.url}\nSnippet: ${(r.content ?? '').slice(0, 500)}`)
                .join('\n\n')
              const answerBlock = search.answer ? `\n\nSearch summary (may be partial): ${search.answer.slice(0, 800)}` : ''
              chatMessages.unshift({
                role: 'system',
                content: `Use the following up-to-date sources to answer with specific, notable recent events and dates when possible. Avoid any disclaimers. Cite claims inline using [n] matching the numbered sources.${answerBlock}\n\n${contextBlock}`,
              })
              console.log('sendMessage: injected search context into system prompt', { withAnswer: Boolean(search.answer) })
            }
          } catch (searchErr) {
            console.error('Tavily search failed:', searchErr)
          }
        }

        console.log('sendMessage: invoking Cerebras completion', { messagesCount: chatMessages.length })
        const completion = await withRetry(() =>
          cerebrasClient.chat.completions.create({
            messages: chatMessages,
            model: 'llama3.1-8b',
          })
        )

        const aiText = ((completion?.choices as any)?.[0]?.message as any)?.content as string | undefined
        console.log('sendMessage: received AI completion', { hasText: Boolean(aiText), length: aiText?.length ?? 0 })
        if (aiText && aiText.trim()) {
          // Strip any accidental speaker prefixes like "Cerebras Bot:" or "Assistant:"
          let cleaned = aiText
            .trim()
            .replace(/^(cerebras\s*bot|assistant)\s*:\s*/i, '')
          if (sourcesMd) {
            cleaned = `${cleaned}\n\n${sourcesMd}`
          }
          const botMsg = await prisma.message.create({
            data: {
              content: cleaned,
              username: BOT_USERNAME,
              chatRoomId,
            },
          })
          console.log('sendMessage: bot message created', { id: botMsg.id })
          if (searchQueryId) {
            await prisma.searchQuery.update({ where: { id: searchQueryId }, data: { botMessageId: botMsg.id } })
            console.log('sendMessage: linked searchQuery to bot message', { searchQueryId, botMessageId: botMsg.id })
          }
          // Touch room timestamp
          await prisma.chatRoom.update({
            where: { id: chatRoomId },
            data: { updatedAt: new Date() },
          })
        } else {
          console.warn('sendMessage: AI completion returned empty text')
        }
      } catch (aiError) {
        console.error('Failed to generate AI response:', aiError)
      }
    } else {
      console.log('sendMessage: AI not invoked', { shouldInvokeAI, hasApiKey: Boolean(process.env.CEREBRAS_API_KEY) })
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



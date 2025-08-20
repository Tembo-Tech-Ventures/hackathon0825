import '@cerebras/cerebras_cloud_sdk/shims/web'
import Cerebras from '@cerebras/cerebras_cloud_sdk'
import { withRetry } from '@/lib/retry'

export const cerebrasClient = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY,
})

export function heuristicsNeedsSearch(message: string): boolean {
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

export function isTimeSensitiveQuery(message: string): boolean {
  const t = message.toLowerCase()
  return (
    /\b(latest|current|today|this week|recent|recently|update|updates|trending|breaking|these days|right now)\b/.test(t) ||
    /\b20\d{2}\b/.test(t) ||
    /\b(past|last)\s+\d+\s+(days|day|weeks|week|months|month)\b/.test(t)
  )
}

export async function classifyNeedsSearchContextual(
  history: Array<{ username: string; content: string }>,
  botUsername: string,
  currentUsername: string,
  shouldRespondHint: boolean,
): Promise<boolean> {
  const latest = history[history.length - 1]
  const message = latest?.content || ''
  const heuristicHint = heuristicsNeedsSearch(message)
  // Signals used in both fallback and LLM path
  const timeSensitive = isTimeSensitiveQuery(message)
  const questionLike = /\?$/.test(message.trim()) || /\b(what|how|when|where|who|which|why|list|top|best|examples|according to)\b/i.test(message)

  // If respond-gate said NO, do not search.
  if (!shouldRespondHint) {
    console.log('classifyNeedsSearchContextual: respond gate -> NO, skip search')
    return false
  }

  // No LLM available: be liberal using signals
  if (!process.env.CEREBRAS_API_KEY) {
    const decision = heuristicHint || timeSensitive || questionLike
    console.log('classifyNeedsSearchContextual: no LLM, signals ->', { heuristicHint, timeSensitive, questionLike, decision })
    return decision
  }

  // If it's plainly a factual/question-like request or time-sensitive, prefer searching without LLM.
  if (heuristicHint || timeSensitive || questionLike) {
    console.log('classifyNeedsSearchContextual: heuristic/question/time -> YES')
    return true
  }

  try {
    const recent = history.slice(-8)
    const convo = recent
      .map((m) => {
        const speaker = m.username === botUsername ? 'ASSISTANT' : `USER(${m.username})`
        const text = (m.content || '').replace(/\s+/g, ' ').slice(0, 500)
        return `${speaker}: ${text}`
      })
      .join('\n')

    const classify = await withRetry(() =>
      cerebrasClient.chat.completions.create({
        model: 'llama3.1-8b',
        messages: [
          {
            role: 'system',
            content:
              'You are a search-decision classifier in a group chat. Decide whether the assistant should perform an external web search for the latest message.\n' +
              '- Reply YES if the latest message seeks factual/grounded information, recent updates, statistics, sources, links, or citations, and up-to-date web results would materially improve the answer beyond the provided conversation.\n' +
              "- Reply NO if the latest message is clearly directed at a specific human user's prior message (not the assistant or the same user), or is a clarification/follow-up that can be answered from the existing conversation context, or is chit-chat/opinion.\n" +
              'Reply ONLY YES or NO.',
          },
          {
            role: 'user',
            content:
              `Conversation (most recent last):\n${convo}\n\n` +
              `Latest message: ${message}\n` +
              `Signals -> timeSensitive: ${timeSensitive}, questionLike: ${questionLike}, heuristicHint: ${heuristicHint}, currentUser: ${currentUsername}\n` +
              'Should the assistant perform an external web search now?',
          },
        ],
      })
    )
    const cls: any = classify
    const decision = String(cls?.choices?.[0]?.message?.content ?? '').trim().toUpperCase()
    console.log('classifyNeedsSearchContextual (LLM):', { decision })
    return decision.startsWith('Y')
  } catch (e) {
    console.error('Search contextual classification failed:', e)
    // Fail-open to heuristics so we still search when it looks clearly factual
    return heuristicHint
  }
}

export async function rewriteSearchQuery(
  original: string,
  opts: { timeSensitive?: boolean } = {},
): Promise<{ query: string }> {
  const trimmed = original.replace(/^\s*(bot|ai)\s*[:,]?\s*/i, '').trim()
  const timeSensitive = !!opts.timeSensitive

  if (!process.env.CEREBRAS_API_KEY) {
    // No LLM available; return baseline
    return { query: trimmed }
  }

  const normalize = (out: string): string => {
    let q = (out || '').trim()
    // remove leading labels like "Query:" or quotes
    q = q.replace(/^query\s*:\s*/i, '')
    q = q.replace(/^"|"$/g, '')
    q = q.replace(/\s+/g, ' ')
    return q
  }

  const sys = [
    'You rewrite user requests into concise, high-signal web search queries.',
    '- Prefer concrete metrics when ambiguous (e.g., "largest" -> choose common metric like revenue, production, or market cap).',
    '- Add obvious qualifiers (industry terms, geography) when implied.',
    '- Avoid question phrasing. Output a short keyword-style query only. No extra text.',
    timeSensitive
      ? `- If the request is time-sensitive, include a recent timeframe like "${
      new Date().getFullYear()
      }" or "last 12 months".`
      : '- If the request is not time-sensitive, do not add recency terms unless explicitly requested.',
  ].join('\n')

  console.log('LLM QUERY REWRITE: START', { input: trimmed, timeSensitive })
  try {
    const resp = await withRetry(() =>
      cerebrasClient.chat.completions.create({
        model: 'llama3.1-8b',
        messages: [
          { role: 'system', content: sys },
          {
            role: 'user',
            content: `Rewrite to a concise search query. Reply with query only.\nInput: ${trimmed}`,
          },
        ],
      })
    )
    const out = String((resp as any)?.choices?.[0]?.message?.content ?? '')
    const query = normalize(out)
    console.log('LLM QUERY REWRITE: DONE', { query })
    return { query: query || trimmed }
  } catch (e: any) {
    console.error('LLM QUERY REWRITE: ERROR', { message: e?.message || String(e) })
    return { query: trimmed }
  }
}

export async function classifyNeedsSearch(message: string): Promise<boolean> {
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

export async function classifyShouldRespond(
  history: Array<{ username: string; content: string }>,
  botUsername: string,
): Promise<boolean> {
  if (!process.env.CEREBRAS_API_KEY) {
    // No LLM available; default to allowing response
    return true
  }
  try {
    const recent = history.slice(-8)
    const convo = recent
      .map((m) => {
        const speaker = m.username === botUsername ? 'ASSISTANT' : `USER(${m.username})`
        const text = (m.content || '').replace(/\s+/g, ' ').slice(0, 500)
        return `${speaker}: ${text}`
      })
      .join('\n')

    const classify = await withRetry(() =>
      cerebrasClient.chat.completions.create({
        model: 'llama3.1-8b',
        messages: [
          {
            role: 'system',
            content:
              'You are a group-chat classifier that decides if the assistant should respond to the latest message.\n' +
              '- Reply YES if the latest message is addressed to the assistant, is a clear reply to the assistant, or is a general question not clearly directed to a specific human.\n' +
              "- Reply NO if the latest message is clearly directed to a specific human user's prior message (e.g., clarifying their point or asking them to share something) and the assistant was not the author of that prior message.\n" +
              'Reply with ONLY YES or NO.',
          },
          {
            role: 'user',
            content: `Conversation (most recent last):\n${convo}\n\nShould the assistant respond?`,
          },
        ],
      })
    )
    const cls: any = classify
    const decision = String(cls?.choices?.[0]?.message?.content ?? '').trim().toUpperCase()
    console.log('classifyShouldRespond (LLM):', { decision })
    return decision.startsWith('Y')
  } catch (e) {
    console.error('Respond classification failed:', e)
    return true // Fail-open so we don't drop important replies
  }
}

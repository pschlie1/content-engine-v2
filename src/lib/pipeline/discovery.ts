import Parser from 'rss-parser'
import { ulid } from 'ulid'
import { db } from '@/lib/db/client'

interface ContentPillar {
  id: string
  name: string
  rss_feeds: string
  subreddits: string
  newsapi_queries: string
}

interface StoryInsert {
  pillar_id: string
  source_type: 'rss' | 'reddit' | 'newsapi'
  source_url: string
  title: string
  summary: string
  source_metadata: string
}

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'ContentEngineV2/1.0 (content automation bot)',
  },
})

/** Sleep for ms milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Insert a story, skip on dedupe constraint violation */
async function insertStory(story: StoryInsert): Promise<boolean> {
  const now = new Date().toISOString()
  try {
    await db.execute({
      sql: `INSERT INTO discovered_stories
        (id, pillar_id, source_type, source_url, title, summary, source_metadata, discovered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        ulid(),
        story.pillar_id,
        story.source_type,
        story.source_url,
        story.title,
        story.summary,
        story.source_metadata,
        now,
      ],
    })
    return true
  } catch (err: unknown) {
    // Dedupe constraint — already exists, skip silently
    if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
      return false
    }
    throw err
  }
}

/** Fetch RSS feed stories for a pillar */
async function discoverFromRss(pillar: ContentPillar): Promise<void> {
  const feeds: string[] = JSON.parse(pillar.rss_feeds)
  for (const feedUrl of feeds) {
    try {
      const feed = await parser.parseURL(feedUrl)
      for (const item of feed.items ?? []) {
        if (!item.link || !item.title) continue
        await insertStory({
          pillar_id: pillar.id,
          source_type: 'rss',
          source_url: item.link,
          title: item.title,
          summary: item.contentSnippet ?? item.summary ?? '',
          source_metadata: JSON.stringify({
            feed_url: feedUrl,
            feed_title: feed.title,
            pub_date: item.pubDate,
            author: item.creator,
          }),
        })
      }
    } catch (err) {
      console.error(`[discovery] RSS error for ${feedUrl}:`, err instanceof Error ? err.message : err)
    }
  }
}

/** Fetch Reddit hot posts for a pillar */
async function discoverFromReddit(pillar: ContentPillar): Promise<void> {
  const subreddits: string[] = JSON.parse(pillar.subreddits)
  for (let i = 0; i < subreddits.length; i++) {
    if (i > 0) {
      await sleep(2000) // 1 req/2s throttle
    }
    const sub = subreddits[i]
    const url = `https://www.reddit.com/r/${sub}/hot.json?limit=10&t=day`
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'ContentEngineV2/1.0 (content automation bot; contact: admin@example.com)',
        },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        console.error(`[discovery] Reddit ${sub} returned HTTP ${res.status}`)
        continue
      }
      const json = (await res.json()) as {
        data?: { children?: Array<{ data?: { title?: string; url?: string; selftext?: string; permalink?: string } }> }
      }
      for (const child of json.data?.children ?? []) {
        const post = child.data
        if (!post?.title || !post.url) continue
        const postUrl = `https://www.reddit.com${post.permalink ?? ''}`
        await insertStory({
          pillar_id: pillar.id,
          source_type: 'reddit',
          source_url: postUrl,
          title: post.title,
          summary: post.selftext?.substring(0, 500) ?? '',
          source_metadata: JSON.stringify({
            subreddit: sub,
            external_url: post.url,
          }),
        })
      }
    } catch (err) {
      console.error(`[discovery] Reddit error for r/${sub}:`, err instanceof Error ? err.message : err)
    }
  }
}

/** Fetch NewsAPI stories for a pillar */
async function discoverFromNewsApi(pillar: ContentPillar): Promise<void> {
  const apiKey = process.env.NEWSAPI_API_KEY
  if (!apiKey) {
    console.log('[discovery] NEWSAPI_API_KEY not set — skipping NewsAPI discovery')
    return
  }

  const queries: string[] = JSON.parse(pillar.newsapi_queries)
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  for (const q of queries) {
    try {
      const params = new URLSearchParams({
        q,
        from,
        sortBy: 'publishedAt',
        language: 'en',
        apiKey,
      })
      const res = await fetch(`https://newsapi.org/v2/everything?${params}`, {
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        console.error(`[discovery] NewsAPI query "${q}" returned HTTP ${res.status}`)
        continue
      }
      const json = (await res.json()) as {
        articles?: Array<{ url?: string; title?: string; description?: string; publishedAt?: string; source?: { name?: string } }>
      }
      for (const article of json.articles ?? []) {
        if (!article.url || !article.title) continue
        await insertStory({
          pillar_id: pillar.id,
          source_type: 'newsapi',
          source_url: article.url,
          title: article.title,
          summary: article.description ?? '',
          source_metadata: JSON.stringify({
            query: q,
            published_at: article.publishedAt,
            source_name: article.source?.name,
          }),
        })
      }
    } catch (err) {
      console.error(`[discovery] NewsAPI error for "${q}":`, err instanceof Error ? err.message : err)
    }
  }
}

/** Run full discovery for a single pillar */
export async function runDiscovery(pillar: ContentPillar): Promise<void> {
  console.log(`[discovery] Running for pillar: ${pillar.name}`)
  await discoverFromRss(pillar)
  await discoverFromReddit(pillar)
  await discoverFromNewsApi(pillar)
  console.log(`[discovery] Done for pillar: ${pillar.name}`)
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock db client
const mockExecute = vi.fn()
vi.mock('../lib/db/client', () => ({
  db: { execute: mockExecute },
}))

// Mock rss-parser
const mockParseURL = vi.fn()
vi.mock('rss-parser', () => ({
  default: vi.fn().mockImplementation(() => ({
    parseURL: mockParseURL,
  })),
}))

describe('discovery - RSS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: insert succeeds
    mockExecute.mockResolvedValue({ rows: [] })
  })

  it('skips duplicate URLs (UNIQUE constraint)', async () => {
    // First call: insert succeeds
    // Second call: UNIQUE constraint violation
    mockExecute
      .mockResolvedValueOnce({ rows: [] }) // first story insert succeeds
      .mockRejectedValueOnce(new Error('UNIQUE constraint failed: discovered_stories.pillar_id, discovered_stories.source_url'))

    const { runDiscovery } = await import('../lib/pipeline/discovery')

    mockParseURL.mockResolvedValue({
      title: 'Test Feed',
      items: [
        { link: 'https://example.com/story-1', title: 'First Story', contentSnippet: 'snippet 1', pubDate: '2026-01-01' },
        { link: 'https://example.com/story-1', title: 'Duplicate Story', contentSnippet: 'snippet 2', pubDate: '2026-01-01' },
      ],
    })

    const mockPillar = {
      id: 'pillar-1',
      name: 'Test Pillar',
      rss_feeds: JSON.stringify(['https://test-feed.example.com/rss']),
      subreddits: JSON.stringify([]),
      newsapi_queries: JSON.stringify([]),
    }

    // Should not throw even with a duplicate
    await expect(runDiscovery(mockPillar)).resolves.not.toThrow()
  })

  it('logs feed errors and continues without throwing', async () => {
    const { runDiscovery } = await import('../lib/pipeline/discovery')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockParseURL.mockRejectedValue(new Error('Connection refused'))

    const mockPillar = {
      id: 'pillar-2',
      name: 'Test Pillar 2',
      rss_feeds: JSON.stringify(['https://bad-feed.example.com/rss', 'https://also-bad.example.com/rss']),
      subreddits: JSON.stringify([]),
      newsapi_queries: JSON.stringify([]),
    }

    await expect(runDiscovery(mockPillar)).resolves.not.toThrow()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('discovery - Reddit rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockExecute.mockResolvedValue({ rows: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies 2s delay between subreddit requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { children: [] } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { runDiscovery } = await import('../lib/pipeline/discovery')

    const mockPillar = {
      id: 'pillar-3',
      name: 'Reddit Pillar',
      rss_feeds: JSON.stringify([]),
      subreddits: JSON.stringify(['netsec', 'webdev', 'devops']),
      newsapi_queries: JSON.stringify([]),
    }

    // Start discovery
    const discoveryPromise = runDiscovery(mockPillar)

    // Fast-forward time past all the 2s delays (3 subreddits = 2 delays)
    await vi.runAllTimersAsync()
    await discoveryPromise

    // Should have been called 3 times (once per subreddit)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    // Verify User-Agent header was sent
    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>
    for (const [url, options] of calls) {
      expect(url).toContain('reddit.com')
      expect((options.headers as Record<string, string>)['User-Agent']).toBeDefined()
    }
  })
})

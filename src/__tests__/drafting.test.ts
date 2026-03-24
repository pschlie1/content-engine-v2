import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to avoid hoisting issues with vi.mock
const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}))

vi.mock('../lib/db/client', () => ({
  db: { execute: mockExecute },
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}))

vi.mock('../lib/pipeline/research', () => ({
  researchStory: vi.fn().mockResolvedValue({
    key_facts: [],
    statistics: [],
    additional_context: '',
    related_angles: [],
  }),
}))

vi.mock('../lib/pipeline/content-check', () => ({
  checkContent: vi.fn().mockReturnValue({ passed: true, violations: [] }),
}))

import { titleToSlug, ensureUniqueSlug } from '../lib/pipeline/drafting'

describe('drafting - slug generation', () => {
  it('converts "My Blog Post" to "my-blog-post"', () => {
    expect(titleToSlug('My Blog Post')).toBe('my-blog-post')
  })

  it('converts title with special characters', () => {
    expect(titleToSlug('API Security: What You Need to Know!')).toBe('api-security-what-you-need-to-know')
  })

  it('handles multiple spaces', () => {
    expect(titleToSlug('Too   Many   Spaces')).toBe('too-many-spaces')
  })

  it('handles leading/trailing spaces', () => {
    expect(titleToSlug('  Trimmed Title  ')).toBe('trimmed-title')
  })

  it('lowercases the title', () => {
    expect(titleToSlug('ALL CAPS TITLE')).toBe('all-caps-title')
  })

  it('handles numbers', () => {
    expect(titleToSlug('Top 10 Security Tips for 2026')).toBe('top-10-security-tips-for-2026')
  })

  it('handles hyphens in title', () => {
    expect(titleToSlug('API-first Design Patterns')).toBe('api-first-design-patterns')
  })
})

describe('drafting - slug uniqueness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns base slug when no duplicate exists', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] })
    const slug = await ensureUniqueSlug('site-1', 'my-blog-post')
    expect(slug).toBe('my-blog-post')
  })

  it('appends -2 when base slug already exists', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }) // base slug taken
      .mockResolvedValueOnce({ rows: [] }) // -2 is available
    const slug = await ensureUniqueSlug('site-1', 'my-blog-post')
    expect(slug).toBe('my-blog-post-2')
  })

  it('appends -3 when -2 also exists', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }) // base slug taken
      .mockResolvedValueOnce({ rows: [{ id: 'existing-2' }] }) // -2 taken
      .mockResolvedValueOnce({ rows: [] }) // -3 is available
    const slug = await ensureUniqueSlug('site-1', 'my-blog-post')
    expect(slug).toBe('my-blog-post-3')
  })
})

describe('drafting - JSON output parsing', () => {
  it('parses valid JSON output from Claude', () => {
    const rawResponse = `{
  "title": "10 API Security Best Practices",
  "meta_description": "Learn the top API security practices for 2026.",
  "body_markdown": "## Introduction\\n\\nSecurity matters.",
  "tags": ["api security", "security", "best practices"]
}`
    const parsed = JSON.parse(rawResponse) as { title: string; meta_description: string; body_markdown: string; tags: string[] }
    expect(parsed.title).toBe('10 API Security Best Practices')
    expect(parsed.meta_description).toBe('Learn the top API security practices for 2026.')
    expect(parsed.tags).toHaveLength(3)
    expect(parsed.tags[0]).toBe('api security')
  })

  it('parses JSON wrapped in markdown code blocks', () => {
    const wrapped = `Here is your blog post:

\`\`\`json
{
  "title": "Security Post",
  "meta_description": "A post about security.",
  "body_markdown": "## Content",
  "tags": ["security"]
}
\`\`\``
    const jsonMatch = wrapped.match(/```(?:json)?\s*([\s\S]*?)```/)
    expect(jsonMatch).not.toBeNull()
    const parsed = JSON.parse(jsonMatch![1].trim()) as { title: string }
    expect(parsed.title).toBe('Security Post')
  })

  it('handles parsing failure gracefully', () => {
    const bad = 'not json at all'
    let result: { title?: string } | null = null
    try {
      result = JSON.parse(bad) as { title?: string }
    } catch {
      result = null
    }
    expect(result).toBeNull()
  })
})

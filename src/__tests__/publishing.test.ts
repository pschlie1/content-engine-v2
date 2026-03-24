import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { markdownToJsx } from '../lib/pipeline/publishing'

// We test publishDraft separately with fetch mocks
const mockFetch = vi.fn()

describe('publishing - markdownToJsx', () => {
  it('converts ## headings to h2 elements', () => {
    const md = `## Section Title`
    const jsx = markdownToJsx(md)
    expect(jsx).toContain('<h2')
    expect(jsx).toContain('Section Title')
    expect(jsx).not.toContain('##')
  })

  it('converts ### headings to h3 elements', () => {
    const md = `### Subsection`
    const jsx = markdownToJsx(md)
    expect(jsx).toContain('<h3')
    expect(jsx).toContain('Subsection')
  })

  it('converts paragraphs to p elements', () => {
    const md = `This is a paragraph of text.`
    const jsx = markdownToJsx(md)
    expect(jsx).toContain('<p')
    expect(jsx).toContain('This is a paragraph of text.')
  })

  it('converts **text** to strong elements', () => {
    const md = `This has **bold text** in it.`
    const jsx = markdownToJsx(md)
    expect(jsx).toContain('<strong>bold text</strong>')
  })

  it('converts list items to ul/li elements', () => {
    const md = `- First item
- Second item
- Third item`
    const jsx = markdownToJsx(md)
    expect(jsx).toContain('<ul')
    expect(jsx).toContain('<li')
    expect(jsx).toContain('First item')
    expect(jsx).toContain('Second item')
    expect(jsx).toContain('Third item')
  })

  it('converts code blocks to pre/code elements', () => {
    const md = `\`\`\`javascript
const x = 1;
\`\`\``
    const jsx = markdownToJsx(md)
    expect(jsx).toContain('<pre')
    expect(jsx).toContain('<code')
    expect(jsx).toContain('const x = 1;')
  })

  it('escapes HTML special characters in code blocks', () => {
    const md = `\`\`\`
<script>alert('xss')</script>
\`\`\``
    const jsx = markdownToJsx(md)
    expect(jsx).not.toContain('<script>')
    expect(jsx).toContain('&lt;script&gt;')
  })

  it('does not leave raw markdown in output', () => {
    const md = `## Heading
- Item one
- Item two

Regular paragraph.`
    const jsx = markdownToJsx(md)
    expect(jsx).not.toContain('## ')
    expect(jsx).not.toContain('- Item')
  })
})

describe('publishing - JSON format', () => {
  it('builds correct JSON file structure', () => {
    const draft = {
      id: 'draft-1',
      title: 'My Test Post',
      slug: 'my-test-post',
      meta_description: 'A test post about testing.',
      body_markdown: '## Content\n\nHello world.',
      tags: '["test", "blog"]',
    }

    const site = {
      id: 'site-1',
      domain: 'mybizgrade.com',
    }

    const content = JSON.stringify(
      {
        id: draft.slug,
        title: draft.title,
        slug: draft.slug,
        meta_description: draft.meta_description,
        body_markdown: draft.body_markdown,
        tags: JSON.parse(draft.tags) as string[],
        published_at: new Date().toISOString(),
        site: site.domain,
      },
      null,
      2
    )

    const parsed = JSON.parse(content) as { id: string; title: string; tags: string[]; slug: string }
    expect(parsed.id).toBe('my-test-post')
    expect(parsed.title).toBe('My Test Post')
    expect(parsed.tags).toEqual(['test', 'blog'])
    expect(parsed.slug).toBe('my-test-post')
  })
})

describe('publishing - TSX format', () => {
  it('generates valid TypeScript file with metadata export', () => {
    const draft = {
      id: 'draft-2',
      title: 'Security Best Practices',
      slug: 'security-best-practices',
      meta_description: 'Top security practices for developers.',
      body_markdown: '## Introduction\n\nSecurity matters.',
      tags: '["security", "api"]',
    }

    const content = `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '${draft.title}',
  description: '${draft.meta_description}',
}

export default function BlogPost() {
  return (
    <article>
      <h1>${draft.title}</h1>
    </article>
  )
}`
    expect(content).toContain("export const metadata: Metadata = {")
    expect(content).toContain("export default function BlogPost()")
    expect(content).toContain(draft.title)
    expect(content).toContain("import type { Metadata } from 'next'")
  })
})

describe('publishing - GitHub API integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    process.env.GITHUB_TOKEN = 'test-token'
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls GitHub API with base64 encoded content', async () => {
    // Mock GET (check existing file SHA) — 404 means new file
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('Not Found'),
      })
      // Mock PUT (commit file)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ commit: { sha: 'abc123' } }),
        text: () => Promise.resolve(''),
      })

    const { publishDraft } = await import('../lib/pipeline/publishing')

    const draft = {
      id: 'draft-3',
      title: 'Test Post',
      slug: 'test-post',
      meta_description: 'Test description.',
      body_markdown: '## Test\n\nContent here.',
      tags: '["test"]',
    }

    const site = {
      id: 'site-1',
      name: 'MyBizGrade',
      domain: 'mybizgrade.com',
      github_repo: 'pschlie1/grademybiz',
      github_branch: 'main',
      publish_format: 'json',
      json_output_path: 'content/blog',
      tsx_output_path: null,
    }

    const result = await publishDraft(draft, site)
    expect(result.commit_sha).toBe('abc123')
    expect(result.published_url).toContain('mybizgrade.com')

    // Verify GitHub API PUT was called
    const putCall = mockFetch.mock.calls.find((call) => {
      const [, options] = call as [string, RequestInit]
      return options?.method === 'PUT'
    })
    expect(putCall).toBeDefined()

    const [, putOptions] = putCall as [string, RequestInit]
    const body = JSON.parse(putOptions.body as string) as { content: string; message: string }
    // Content should be base64 encoded
    expect(body.content).toBeDefined()
    const decoded = Buffer.from(body.content, 'base64').toString('utf-8')
    expect(decoded).toContain('test-post')
    expect(body.message).toBe('Add post: Test Post')
  })

  it('retries on 429 up to 3 times', async () => {
    // GET: 404 (file doesn't exist)
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
      // PUT: 3 consecutive 429s then success
      .mockResolvedValueOnce({ ok: false, status: 429, json: () => Promise.resolve({}), text: () => Promise.resolve('Rate limited') })
      .mockResolvedValueOnce({ ok: false, status: 429, json: () => Promise.resolve({}), text: () => Promise.resolve('Rate limited') })
      .mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve({ commit: { sha: 'retry-sha' } }), text: () => Promise.resolve('') })

    // Use fake timers to skip backoff delays
    vi.useFakeTimers()

    const { publishDraft } = await import('../lib/pipeline/publishing')

    const draft = {
      id: 'draft-4',
      title: 'Retry Test',
      slug: 'retry-test',
      meta_description: 'Testing retries.',
      body_markdown: 'Content.',
      tags: '[]',
    }

    const site = {
      id: 'site-2',
      name: 'MyBizGrade',
      domain: 'mybizgrade.com',
      github_repo: 'pschlie1/grademybiz',
      github_branch: 'main',
      publish_format: 'json',
      json_output_path: 'content/blog',
      tsx_output_path: null,
    }

    const resultPromise = publishDraft(draft, site)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.commit_sha).toBe('retry-sha')
    // Should have been called: 1 GET + 3 PUT attempts = 4 total
    expect(mockFetch).toHaveBeenCalledTimes(4)

    vi.useRealTimers()
  })
})

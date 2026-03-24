interface Draft {
  id: string
  title: string
  slug: string
  meta_description: string
  body_markdown: string
  tags: string
}

interface Site {
  id: string
  name: string
  domain: string
  github_repo: string
  github_branch: string
  publish_format: string
  json_output_path: string | null
  tsx_output_path: string | null
}

interface GitHubFileResponse {
  sha?: string
  content?: string
}

interface PublishResult {
  commit_sha: string
  published_url: string
}

const GITHUB_API_BASE = 'https://api.github.com'

/** Sleep for ms milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Fetch with retry: 3x with exponential backoff on 429 or 5xx */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  const delays = [1000, 2000, 4000]
  let lastErr: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, options)

    if (res.status === 409) {
      // Conflict — caller handles SHA refresh
      return res
    }

    if (res.ok) {
      return res
    }

    if (res.status === 429 || res.status >= 500) {
      console.warn(`[publishing] HTTP ${res.status} on attempt ${attempt + 1}/${maxRetries}`)
      if (attempt < maxRetries - 1) {
        await sleep(delays[attempt])
      }
      lastErr = new Error(`HTTP ${res.status}`)
      continue
    }

    // Other errors — don't retry
    throw new Error(`GitHub API error: HTTP ${res.status} ${await res.text()}`)
  }

  throw lastErr ?? new Error('Max retries exceeded')
}

/** Get current file SHA (needed for updates) */
async function getFileSha(repo: string, path: string, branch: string): Promise<string | null> {
  const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${path}?ref=${branch}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) return null
  const data = (await res.json()) as GitHubFileResponse
  return data.sha ?? null
}

/** Commit a file to GitHub via Contents API */
async function commitFile(
  repo: string,
  branch: string,
  filePath: string,
  content: string,
  message: string,
  currentSha?: string | null
): Promise<string> {
  const base64Content = Buffer.from(content, 'utf-8').toString('base64')
  const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${filePath}`

  const body: Record<string, unknown> = {
    message,
    content: base64Content,
    branch,
  }
  if (currentSha) {
    body.sha = currentSha
  }

  const options: RequestInit = {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }

  let res = await fetchWithRetry(url, options)

  // Handle 409 conflict: get fresh SHA and retry
  if (res.status === 409) {
    console.warn(`[publishing] 409 conflict on ${filePath} — fetching fresh SHA`)
    const freshSha = await getFileSha(repo, filePath, branch)
    body.sha = freshSha
    options.body = JSON.stringify(body)
    res = await fetchWithRetry(url, options)
  }

  if (!res.ok) {
    throw new Error(`Failed to commit ${filePath}: HTTP ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as { commit?: { sha?: string } }
  return data.commit?.sha ?? ''
}

/** Convert markdown to safe JSX */
export function markdownToJsx(markdown: string): string {
  const lines = markdown.split('\n')
  const jsxLines: string[] = []
  let inCodeBlock = false
  let codeBlockLines: string[] = []
  let inList = false
  let listItems: string[] = []

  function flushList(): void {
    if (listItems.length > 0) {
      jsxLines.push('              <ul className="list-disc pl-6 mb-4">')
      for (const item of listItems) {
        jsxLines.push(`                <li className="mb-1">${item}</li>`)
      }
      jsxLines.push('              </ul>')
      listItems = []
      inList = false
    }
  }

  function convertInline(text: string): string {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code className="bg-gray-100 px-1 rounded">$1</code>')
  }

  for (const line of lines) {
    // Handle fenced code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        jsxLines.push('              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg mb-4 overflow-x-auto"><code>')
        jsxLines.push(codeBlockLines.map((l) => l.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c))).join('\n'))
        jsxLines.push('              </code></pre>')
        codeBlockLines = []
        inCodeBlock = false
      } else {
        flushList()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(line)
      continue
    }

    // Headings
    if (line.startsWith('### ')) {
      flushList()
      jsxLines.push(`              <h3 className="text-xl font-semibold mt-6 mb-3">${convertInline(line.slice(4))}</h3>`)
      continue
    }
    if (line.startsWith('## ')) {
      flushList()
      jsxLines.push(`              <h2 className="text-2xl font-bold mt-8 mb-4">${convertInline(line.slice(3))}</h2>`)
      continue
    }
    if (line.startsWith('# ')) {
      flushList()
      jsxLines.push(`              <h1 className="text-3xl font-bold mt-8 mb-4">${convertInline(line.slice(2))}</h1>`)
      continue
    }

    // List items
    if (line.match(/^[-*+] /)) {
      inList = true
      listItems.push(convertInline(line.replace(/^[-*+] /, '')))
      continue
    }

    // Flush list if we hit a non-list line
    if (inList) {
      flushList()
    }

    // Empty line
    if (line.trim() === '') {
      continue
    }

    // Regular paragraph
    jsxLines.push(`              <p className="mb-4">${convertInline(line)}</p>`)
  }

  flushList()

  return jsxLines.join('\n')
}

/** Generate a page.tsx file for Scantient blog post */
function generateTsxContent(draft: Draft, site: Site): string {
  const tags: string[] = JSON.parse(draft.tags)
  const jsxBody = markdownToJsx(draft.body_markdown)

  return `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '${draft.title.replace(/'/g, "\\'")}',
  description: '${draft.meta_description.replace(/'/g, "\\'")}',
  openGraph: {
    title: '${draft.title.replace(/'/g, "\\'")}',
    description: '${draft.meta_description.replace(/'/g, "\\'")}',
    type: 'article',
  },
}

export default function BlogPost() {
  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <header className="mb-8">
        <div className="flex flex-wrap gap-2 mb-4">
          ${tags.map((tag) => `<span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">${tag}</span>`).join('\n          ')}
        </div>
        <h1 className="text-4xl font-bold mb-4">${draft.title.replace(/'/g, "\\'")}</h1>
        <p className="text-gray-600">${draft.meta_description.replace(/'/g, "\\'")}</p>
      </header>
      <div className="prose prose-lg max-w-none">
${jsxBody}
      </div>
    </article>
  )
}
`
}

/** Build JSON content for MyBizGrade blog */
function buildJsonContent(draft: Draft, site: Site): string {
  const tags: string[] = JSON.parse(draft.tags)
  return JSON.stringify(
    {
      id: draft.slug,
      title: draft.title,
      slug: draft.slug,
      meta_description: draft.meta_description,
      body_markdown: draft.body_markdown,
      tags,
      published_at: new Date().toISOString(),
      site: site.domain,
    },
    null,
    2
  )
}

/** Publish a draft to GitHub based on site publish_format */
export async function publishDraft(draft: Draft, site: Site): Promise<PublishResult> {
  console.log(`[publishing] Publishing draft "${draft.title}" to ${site.github_repo}`)

  if (site.publish_format === 'tsx') {
    if (!site.tsx_output_path) {
      throw new Error(`Site ${site.id} has publish_format=tsx but no tsx_output_path`)
    }

    const filePath = `${site.tsx_output_path}/${draft.slug}/page.tsx`
    const content = generateTsxContent(draft, site)
    const sha = await getFileSha(site.github_repo, filePath, site.github_branch)
    const commitSha = await commitFile(
      site.github_repo,
      site.github_branch,
      filePath,
      content,
      `Add post: ${draft.title}`,
      sha
    )

    const publishedUrl = `https://${site.domain}/blog/${draft.slug}`
    console.log(`[publishing] TSX post committed: ${filePath} (sha: ${commitSha})`)
    return { commit_sha: commitSha, published_url: publishedUrl }
  }

  if (site.publish_format === 'json') {
    if (!site.json_output_path) {
      throw new Error(`Site ${site.id} has publish_format=json but no json_output_path`)
    }

    const filePath = `${site.json_output_path}/${draft.slug}.json`
    const content = buildJsonContent(draft, site)
    const sha = await getFileSha(site.github_repo, filePath, site.github_branch)
    const commitSha = await commitFile(
      site.github_repo,
      site.github_branch,
      filePath,
      content,
      `Add post: ${draft.title}`,
      sha
    )

    const publishedUrl = `https://${site.domain}/blog/${draft.slug}`
    console.log(`[publishing] JSON post committed: ${filePath} (sha: ${commitSha})`)
    return { commit_sha: commitSha, published_url: publishedUrl }
  }

  throw new Error(`Unknown publish_format: ${site.publish_format}`)
}

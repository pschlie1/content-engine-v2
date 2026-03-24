import Anthropic from '@anthropic-ai/sdk'
import { ulid } from 'ulid'
import { db } from '@/lib/db/client'
import { checkContent } from './content-check'
import { researchStory, type ResearchBrief } from './research'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface Site {
  id: string
  name: string
  domain: string
  tone_guidelines: string
  product_context: string | null
  audience_description: string
}

interface ContentPillar {
  id: string
  name: string
  description: string
  target_keywords: string
}

interface Story {
  id: string
  title: string
  summary: string
  source_url: string
}

interface DraftOutput {
  title: string
  meta_description: string
  body_markdown: string
  tags: string[]
}

/** Convert a title to a kebab-case slug */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

/** Ensure slug is unique for a given site, append -2, -3, etc. if needed */
export async function ensureUniqueSlug(siteId: string, baseSlug: string): Promise<string> {
  let slug = baseSlug
  let counter = 1

  while (true) {
    const result = await db.execute({
      sql: `SELECT id FROM drafts WHERE site_id = ? AND slug = ?`,
      args: [siteId, slug],
    })
    if (result.rows.length === 0) return slug
    counter++
    slug = `${baseSlug}-${counter}`
  }
}

/** Generate a draft for a selected story */
export async function generateDraft(
  story: Story,
  pillar: ContentPillar,
  site: Site
): Promise<string | null> {
  console.log(`[drafting] Generating draft for: ${story.title}`)

  // Research phase
  const researchBrief = await researchStory(story)

  const keywords: string[] = JSON.parse(pillar.target_keywords)

  const systemPrompt = `You are a blog post writer for ${site.name} (${site.domain}).

Tone guidelines: ${site.tone_guidelines}

Product/brand context: ${site.product_context ?? ''}

Target audience: ${site.audience_description}

Content pillar: ${pillar.name} - ${pillar.description}

Write blog posts that are:
- 800-1500 words
- SEO-optimized for these keywords: ${keywords.join(', ')}
- Written in markdown (no JSX components, no HTML)
- Structured with a compelling title, clear subheadings (##), and actionable takeaways

Return JSON only:
{
  "title": "...",
  "meta_description": "under 160 characters",
  "body_markdown": "full post in markdown",
  "tags": ["tag1", "tag2", "tag3"]
}`

  const userPrompt = `Story title: ${story.title}
Source URL: ${story.source_url}
Summary: ${story.summary}

Research brief:
Key facts: ${researchBrief.key_facts.join('; ')}
Statistics: ${researchBrief.statistics.map((s) => `${s.stat} (${s.source})`).join('; ')}
Additional context: ${researchBrief.additional_context}
Related angles: ${researchBrief.related_angles.join('; ')}

Write a blog post based on this story and research.`

  let draftOutput: DraftOutput
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from drafting agent')
    }

    // Extract JSON from response (may be wrapped in markdown code blocks)
    const rawText = textBlock.text
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? null
    const jsonStr = jsonMatch ? jsonMatch[1] : rawText
    draftOutput = JSON.parse(jsonStr.trim()) as DraftOutput
  } catch (err) {
    console.error(`[drafting] Error generating draft for story ${story.id}:`, err)
    return null
  }

  // Content check
  const checkResult = checkContent(draftOutput.body_markdown)
  if (!checkResult.passed) {
    console.warn(`[drafting] Content check violations: ${checkResult.violations.length} issue(s) in draft for "${draftOutput.title}"`)
  }

  // Build slug
  const baseSlug = titleToSlug(draftOutput.title)
  const slug = await ensureUniqueSlug(site.id, baseSlug)

  // Save draft
  const draftId = ulid()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO drafts
      (id, story_id, site_id, pillar_id, title, slug, meta_description, body_markdown,
       tags, research_brief, content_check_violations, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?)`,
    args: [
      draftId,
      story.id,
      site.id,
      pillar.id,
      draftOutput.title,
      slug,
      draftOutput.meta_description,
      draftOutput.body_markdown,
      JSON.stringify(draftOutput.tags),
      JSON.stringify(researchBrief),
      JSON.stringify(checkResult.violations),
      now,
      now,
    ],
  })

  // Mark story as processed
  await db.execute({
    sql: `UPDATE discovered_stories SET status = 'processed' WHERE id = ?`,
    args: [story.id],
  })

  console.log(`[drafting] Created draft ${draftId} (slug: ${slug})`)
  return draftId
}

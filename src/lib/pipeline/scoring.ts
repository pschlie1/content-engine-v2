import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db/client'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ContentPillar {
  id: string
  name: string
  description: string
  target_keywords: string
  score_threshold: number
  site_id: string
}

interface Site {
  id: string
  audience_description: string
}

interface Story {
  id: string
  title: string
  summary: string
  source_url: string
  source_type: string
}

interface ScoreResult {
  story_id: string
  relevance_score: number
  justification: string
}

const SCORING_SYSTEM_PROMPT = `You are a content relevance scoring agent. You evaluate stories against a content pillar definition and target audience.

For each story, assign a relevance_score between 0 and 100 based on:
- Topical alignment with the pillar description (40%)
- Audience interest level for the target audience (30%)
- Freshness and timeliness (15%)
- Differentiation from recently published posts (15%)

Return JSON only, no other text.`

export function buildScoringPrompt(
  pillar: ContentPillar,
  site: Site,
  stories: Story[],
  recentTitles: string[],
  pendingDraftTitles: string[]
): string {
  const keywords: string[] = JSON.parse(pillar.target_keywords)

  return `Pillar: ${pillar.name}
Description: ${pillar.description}
Target Keywords: ${keywords.join(', ')}
Audience: ${site.audience_description}

Recently published titles (last 14 days):
${recentTitles.length > 0 ? recentTitles.map((t) => `- ${t}`).join('\n') : '(none)'}

Pending draft titles (do not duplicate these):
${pendingDraftTitles.length > 0 ? pendingDraftTitles.map((t) => `- ${t}`).join('\n') : '(none)'}

Score these stories:
${JSON.stringify(
  stories.map((s) => ({
    story_id: s.id,
    title: s.title,
    summary: s.summary,
    source_type: s.source_type,
  })),
  null,
  2
)}

Return JSON array:
[{"story_id": "...", "relevance_score": N, "justification": "one sentence"}]`
}

export async function scoreStoriesForPillar(pillar: ContentPillar, site: Site): Promise<ScoreResult[]> {
  // Fetch unscored stories for this pillar
  const storiesResult = await db.execute({
    sql: `SELECT id, title, summary, source_url, source_type FROM discovered_stories
          WHERE pillar_id = ? AND status = 'discovered'
          ORDER BY discovered_at DESC
          LIMIT 20`,
    args: [pillar.id],
  })

  const stories = storiesResult.rows as unknown as Story[]
  if (stories.length === 0) {
    console.log(`[scoring] No stories to score for pillar: ${pillar.name}`)
    return []
  }

  // Fetch recent published post titles (last 14 days)
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const recentResult = await db.execute({
    sql: `SELECT title FROM drafts
          WHERE site_id = ? AND status = 'published' AND published_at >= ?`,
    args: [pillar.site_id, cutoff],
  })
  const recentTitles = recentResult.rows.map((r) => r.title as string)

  // Fetch pending draft titles (prevent near-duplicates)
  const pendingResult = await db.execute({
    sql: `SELECT title FROM drafts
          WHERE site_id = ? AND status = 'pending_review'`,
    args: [pillar.site_id],
  })
  const pendingDraftTitles = pendingResult.rows.map((r) => r.title as string)

  const userPrompt = buildScoringPrompt(pillar, site, stories, recentTitles, pendingDraftTitles)

  let scores: ScoreResult[] = []
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SCORING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    scores = JSON.parse(text) as ScoreResult[]
  } catch (err) {
    console.error(`[scoring] Claude API or parse error for pillar ${pillar.name}:`, err)
    return []
  }

  // Update story statuses and scores
  const now = new Date().toISOString()
  for (const score of scores) {
    const status = score.relevance_score >= pillar.score_threshold ? 'selected' : 'skipped'
    await db.execute({
      sql: `UPDATE discovered_stories
            SET status = ?, relevance_score = ?, score_justification = ?
            WHERE id = ?`,
      args: [status, score.relevance_score, score.justification, score.story_id],
    })
  }

  const selected = scores.filter((s) => s.relevance_score >= pillar.score_threshold)
  console.log(`[scoring] Pillar ${pillar.name}: ${selected.length}/${scores.length} stories selected`)

  return scores
}

import { ulid } from 'ulid'
import { db } from '@/lib/db/client'
import { runDiscovery } from './discovery'
import { scoreStoriesForPillar } from './scoring'
import { generateDraft } from './drafting'

interface StageLog {
  stage: string
  status: 'success' | 'error'
  message: string
  timestamp: string
  details?: Record<string, unknown>
}

async function appendStageLog(runId: string, log: StageLog): Promise<void> {
  const result = await db.execute({
    sql: `SELECT stages_log FROM pipeline_runs WHERE id = ?`,
    args: [runId],
  })
  if (result.rows.length === 0) return

  const existing: StageLog[] = JSON.parse((result.rows[0].stages_log as string) ?? '[]')
  existing.push(log)

  await db.execute({
    sql: `UPDATE pipeline_runs SET stages_log = ? WHERE id = ?`,
    args: [JSON.stringify(existing), runId],
  })
}

/** Run the full content pipeline for all (or specific) sites/pillars */
export async function runPipeline(siteId?: string, pillarId?: string): Promise<string> {
  const runId = ulid()
  const now = new Date().toISOString()

  // Create pipeline run record
  await db.execute({
    sql: `INSERT INTO pipeline_runs (id, site_id, pillar_id, trigger_type, status, stages_log, started_at)
          VALUES (?, ?, ?, 'manual', 'running', '[]', ?)`,
    args: [runId, siteId ?? null, pillarId ?? null, now],
  })

  console.log(`[orchestrator] Pipeline run ${runId} started`)

  let overallStatus: 'completed' | 'failed' = 'completed'
  let errorMessage: string | null = null

  try {
    // Fetch active sites
    const sitesResult = await db.execute({
      sql: siteId
        ? `SELECT * FROM sites WHERE id = ? AND is_active = 1`
        : `SELECT * FROM sites WHERE is_active = 1`,
      args: siteId ? [siteId] : [],
    })

    const sites = sitesResult.rows as unknown as Array<{
      id: string
      name: string
      domain: string
      github_repo: string
      github_branch: string
      publish_format: string
      json_output_path: string | null
      tsx_output_path: string | null
      tone_guidelines: string
      product_context: string | null
      audience_description: string
    }>

    for (const site of sites) {
      // Fetch active pillars for this site
      const pillarsResult = await db.execute({
        sql: pillarId
          ? `SELECT * FROM content_pillars WHERE site_id = ? AND id = ? AND is_active = 1`
          : `SELECT * FROM content_pillars WHERE site_id = ? AND is_active = 1`,
        args: pillarId ? [site.id, pillarId] : [site.id],
      })

      const pillars = pillarsResult.rows as unknown as Array<{
        id: string
        name: string
        description: string
        target_keywords: string
        rss_feeds: string
        subreddits: string
        newsapi_queries: string
        score_threshold: number
        max_drafts_per_day: number
        site_id: string
      }>

      for (const pillar of pillars) {
        console.log(`[orchestrator] Processing pillar: ${site.name} / ${pillar.name}`)

        // Stage: Discovery
        try {
          await runDiscovery(pillar)
          await appendStageLog(runId, {
            stage: 'discovery',
            status: 'success',
            message: `Discovery completed for ${site.name}/${pillar.name}`,
            timestamp: new Date().toISOString(),
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[orchestrator] Discovery failed for ${pillar.name}:`, msg)
          await appendStageLog(runId, {
            stage: 'discovery',
            status: 'error',
            message: msg,
            timestamp: new Date().toISOString(),
          })
          continue
        }

        // Stage: Scoring
        let scores: { story_id: string; relevance_score: number }[] = []
        try {
          scores = await scoreStoriesForPillar(pillar, site)
          await appendStageLog(runId, {
            stage: 'scoring',
            status: 'success',
            message: `Scored ${scores.length} stories for ${pillar.name}`,
            timestamp: new Date().toISOString(),
            details: { scored: scores.length, selected: scores.filter((s) => s.relevance_score >= pillar.score_threshold).length },
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[orchestrator] Scoring failed for ${pillar.name}:`, msg)
          await appendStageLog(runId, {
            stage: 'scoring',
            status: 'error',
            message: msg,
            timestamp: new Date().toISOString(),
          })
          continue
        }

        // Stage: Drafting (for selected stories, up to max_drafts_per_day)
        const selectedResult = await db.execute({
          sql: `SELECT id, title, summary, source_url FROM discovered_stories
                WHERE pillar_id = ? AND status = 'selected'
                ORDER BY relevance_score DESC
                LIMIT ?`,
          args: [pillar.id, pillar.max_drafts_per_day],
        })

        const selectedStories = selectedResult.rows as unknown as Array<{
          id: string
          title: string
          summary: string
          source_url: string
        }>

        let draftsCreated = 0
        for (const story of selectedStories) {
          try {
            const draftId = await generateDraft(story, pillar, site)
            if (draftId) draftsCreated++
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`[orchestrator] Drafting failed for story ${story.id}:`, msg)
          }
        }

        await appendStageLog(runId, {
          stage: 'drafting',
          status: 'success',
          message: `Created ${draftsCreated} drafts for ${pillar.name}`,
          timestamp: new Date().toISOString(),
          details: { drafts_created: draftsCreated },
        })
      }
    }
  } catch (err) {
    overallStatus = 'failed'
    errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[orchestrator] Pipeline run ${runId} failed:`, errorMessage)
  }

  const completedAt = new Date().toISOString()
  await db.execute({
    sql: `UPDATE pipeline_runs SET status = ?, completed_at = ?, error_message = ? WHERE id = ?`,
    args: [overallStatus, completedAt, errorMessage, runId],
  })

  console.log(`[orchestrator] Pipeline run ${runId} ${overallStatus}`)
  return runId
}

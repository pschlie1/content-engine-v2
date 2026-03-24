import { notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import DraftDetail from '@/components/DraftDetail'

interface DraftRow {
  id: string
  title: string
  slug: string
  meta_description: string
  body_markdown: string
  tags: string
  status: string
  site_id: string
  site_name: string
  site_domain: string
  publish_format: string
  pillar_name: string
  relevance_score: number | null
  source_url: string
  source_type: string
  content_check_violations: string
  rejection_reason: string | null
  published_url: string | null
  github_commit_sha: string | null
  created_at: string
  review_started_at: string | null
  review_completed_at: string | null
}

async function getDraft(id: string): Promise<DraftRow | null> {
  const result = await db.execute({
    sql: `SELECT d.*, s.name as site_name, s.domain as site_domain, s.publish_format,
                 cp.name as pillar_name,
                 ds.source_url, ds.relevance_score, ds.source_type
          FROM drafts d
          JOIN sites s ON d.site_id = s.id
          JOIN content_pillars cp ON d.pillar_id = cp.id
          JOIN discovered_stories ds ON d.story_id = ds.id
          WHERE d.id = ?`,
    args: [id],
  })
  if (result.rows.length === 0) return null
  return result.rows[0] as unknown as DraftRow
}

export default async function DraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const draft = await getDraft(id)

  if (!draft) notFound()

  return <DraftDetail draft={draft} />
}

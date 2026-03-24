import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { publishDraft } from '@/lib/pipeline/publishing'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    // Fetch draft with site info
    const result = await db.execute({
      sql: `SELECT d.*, s.github_repo, s.github_branch, s.publish_format,
                   s.json_output_path, s.tsx_output_path, s.name as site_name, s.domain
            FROM drafts d
            JOIN sites s ON d.site_id = s.id
            WHERE d.id = ?`,
      args: [id],
    })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Draft not found' } }, { status: 404 })
    }

    const row = result.rows[0] as Record<string, unknown>

    if (row.status !== 'pending_review') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: `Cannot approve draft with status: ${row.status}` } },
        { status: 422 }
      )
    }

    const now = new Date().toISOString()

    // Update status to approved and set review_completed_at
    await db.execute({
      sql: `UPDATE drafts SET status = 'approved', review_completed_at = ?, updated_at = ? WHERE id = ?`,
      args: [now, now, id],
    })

    // Publish to GitHub
    const draft = {
      id: row.id as string,
      title: row.title as string,
      slug: row.slug as string,
      meta_description: row.meta_description as string,
      body_markdown: row.body_markdown as string,
      tags: row.tags as string,
    }

    const site = {
      id: row.site_id as string,
      name: row.site_name as string,
      domain: row.domain as string,
      github_repo: row.github_repo as string,
      github_branch: row.github_branch as string,
      publish_format: row.publish_format as string,
      json_output_path: row.json_output_path as string | null,
      tsx_output_path: row.tsx_output_path as string | null,
    }

    const publishResult = await publishDraft(draft, site)

    // Update draft with published info
    await db.execute({
      sql: `UPDATE drafts
            SET status = 'published', github_commit_sha = ?, published_url = ?,
                published_at = ?, updated_at = ?
            WHERE id = ?`,
      args: [publishResult.commit_sha, publishResult.published_url, now, now, id],
    })

    const updated = await db.execute({ sql: `SELECT * FROM drafts WHERE id = ?`, args: [id] })
    return NextResponse.json({ data: updated.rows[0] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[POST /api/v1/drafts/${id}/approve]`, err)

    // Mark as publish_failed
    const now = new Date().toISOString()
    await db.execute({
      sql: `UPDATE drafts SET status = 'publish_failed', updated_at = ? WHERE id = ?`,
      args: [now, id],
    }).catch(() => {})

    return NextResponse.json(
      { error: { code: 'PUBLISH_FAILED', message: msg } },
      { status: 500 }
    )
  }
}

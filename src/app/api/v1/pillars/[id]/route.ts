import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/client'

const UpdatePillarSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  target_keywords: z.array(z.string()).optional(),
  rss_feeds: z.array(z.string()).optional(),
  subreddits: z.array(z.string()).optional(),
  newsapi_queries: z.array(z.string()).optional(),
  max_drafts_per_day: z.number().int().positive().optional(),
  score_threshold: z.number().int().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body: unknown = await req.json()
    const parsed = UpdatePillarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues } },
        { status: 400 }
      )
    }

    const data = parsed.data
    const now = new Date().toISOString()
    const fields: string[] = []
    const args: unknown[] = []

    if (data.name !== undefined) { fields.push('name = ?'); args.push(data.name) }
    if (data.description !== undefined) { fields.push('description = ?'); args.push(data.description) }
    if (data.target_keywords !== undefined) { fields.push('target_keywords = ?'); args.push(JSON.stringify(data.target_keywords)) }
    if (data.rss_feeds !== undefined) { fields.push('rss_feeds = ?'); args.push(JSON.stringify(data.rss_feeds)) }
    if (data.subreddits !== undefined) { fields.push('subreddits = ?'); args.push(JSON.stringify(data.subreddits)) }
    if (data.newsapi_queries !== undefined) { fields.push('newsapi_queries = ?'); args.push(JSON.stringify(data.newsapi_queries)) }
    if (data.max_drafts_per_day !== undefined) { fields.push('max_drafts_per_day = ?'); args.push(data.max_drafts_per_day) }
    if (data.score_threshold !== undefined) { fields.push('score_threshold = ?'); args.push(data.score_threshold) }
    if (data.is_active !== undefined) { fields.push('is_active = ?'); args.push(data.is_active ? 1 : 0) }

    if (fields.length === 0) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } }, { status: 400 })
    }

    fields.push('updated_at = ?')
    args.push(now)
    args.push(id)

    await db.execute({ sql: `UPDATE content_pillars SET ${fields.join(', ')} WHERE id = ?`, args })
    const result = await db.execute({ sql: `SELECT * FROM content_pillars WHERE id = ?`, args: [id] })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Pillar not found' } }, { status: 404 })
    }
    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error(`[PATCH /api/v1/pillars/${id}]`, err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update pillar' } }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const check = await db.execute({ sql: `SELECT id FROM content_pillars WHERE id = ?`, args: [id] })
    if (check.rows.length === 0) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Pillar not found' } }, { status: 404 })
    }
    await db.execute({ sql: `DELETE FROM content_pillars WHERE id = ?`, args: [id] })
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    console.error(`[DELETE /api/v1/pillars/${id}]`, err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete pillar' } }, { status: 500 })
  }
}

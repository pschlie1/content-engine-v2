import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/client'

const UpdateDraftSchema = z.object({
  title: z.string().min(1).optional(),
  meta_description: z.string().optional(),
  body_markdown: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
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
    if (result.rows.length === 0) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Draft not found' } }, { status: 404 })
    }
    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error(`[GET /api/v1/drafts/${id}]`, err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch draft' } }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body: unknown = await req.json()
    const parsed = UpdateDraftSchema.safeParse(body)
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

    if (data.title !== undefined) { fields.push('title = ?'); args.push(data.title) }
    if (data.meta_description !== undefined) { fields.push('meta_description = ?'); args.push(data.meta_description) }
    if (data.body_markdown !== undefined) { fields.push('body_markdown = ?'); args.push(data.body_markdown) }
    if (data.tags !== undefined) { fields.push('tags = ?'); args.push(JSON.stringify(data.tags)) }

    if (fields.length === 0) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } }, { status: 400 })
    }

    fields.push('updated_at = ?')
    args.push(now)
    args.push(id)

    await db.execute({ sql: `UPDATE drafts SET ${fields.join(', ')} WHERE id = ?`, args })
    const result = await db.execute({ sql: `SELECT * FROM drafts WHERE id = ?`, args: [id] })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Draft not found' } }, { status: 404 })
    }
    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error(`[PATCH /api/v1/drafts/${id}]`, err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update draft' } }, { status: 500 })
  }
}

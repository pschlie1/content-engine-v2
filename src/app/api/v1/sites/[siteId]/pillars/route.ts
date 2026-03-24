import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ulid } from 'ulid'
import { db } from '@/lib/db/client'

const CreatePillarSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  target_keywords: z.array(z.string()).default([]),
  rss_feeds: z.array(z.string()).default([]),
  subreddits: z.array(z.string()).default([]),
  newsapi_queries: z.array(z.string()).default([]),
  max_drafts_per_day: z.number().int().positive().default(2),
  score_threshold: z.number().int().min(0).max(100).default(70),
  is_active: z.boolean().default(true),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params
  try {
    const result = await db.execute({
      sql: `SELECT * FROM content_pillars WHERE site_id = ? ORDER BY created_at DESC`,
      args: [siteId],
    })
    return NextResponse.json({ data: result.rows })
  } catch (err) {
    console.error(`[GET /api/v1/sites/${siteId}/pillars]`, err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch pillars' } }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params
  try {
    const siteCheck = await db.execute({ sql: `SELECT id FROM sites WHERE id = ?`, args: [siteId] })
    if (siteCheck.rows.length === 0) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Site not found' } }, { status: 404 })
    }

    const body: unknown = await req.json()
    const parsed = CreatePillarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues } },
        { status: 400 }
      )
    }

    const data = parsed.data
    const id = ulid()
    const now = new Date().toISOString()

    await db.execute({
      sql: `INSERT INTO content_pillars
        (id, site_id, name, description, target_keywords, rss_feeds, subreddits,
         newsapi_queries, max_drafts_per_day, score_threshold, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, siteId, data.name, data.description,
        JSON.stringify(data.target_keywords), JSON.stringify(data.rss_feeds),
        JSON.stringify(data.subreddits), JSON.stringify(data.newsapi_queries),
        data.max_drafts_per_day, data.score_threshold, data.is_active ? 1 : 0,
        now, now,
      ],
    })

    const result = await db.execute({ sql: `SELECT * FROM content_pillars WHERE id = ?`, args: [id] })
    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  } catch (err) {
    console.error(`[POST /api/v1/sites/${siteId}/pillars]`, err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create pillar' } }, { status: 500 })
  }
}

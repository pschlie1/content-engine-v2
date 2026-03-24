import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const site_id = searchParams.get('site_id')
    const status = searchParams.get('status')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
    const offset = (page - 1) * limit

    const conditions: string[] = []
    const args: unknown[] = []

    if (site_id) { conditions.push('d.site_id = ?'); args.push(site_id) }
    if (status) { conditions.push('d.status = ?'); args.push(status) }
    if (date_from) { conditions.push('d.created_at >= ?'); args.push(date_from) }
    if (date_to) { conditions.push('d.created_at <= ?'); args.push(date_to) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await db.execute({
      sql: `SELECT d.*, s.name as site_name, s.domain as site_domain,
                   cp.name as pillar_name
            FROM drafts d
            JOIN sites s ON d.site_id = s.id
            JOIN content_pillars cp ON d.pillar_id = cp.id
            ${where}
            ORDER BY d.created_at DESC
            LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    })

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM drafts d ${where}`,
      args,
    })
    const total = (countResult.rows[0] as { total: number }).total

    return NextResponse.json({
      data: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[GET /api/v1/drafts]', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch drafts' } }, { status: 500 })
  }
}

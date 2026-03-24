import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const site_id = searchParams.get('site_id')
    const status = searchParams.get('status')

    const conditions: string[] = []
    const args: unknown[] = []

    if (site_id) { conditions.push('site_id = ?'); args.push(site_id) }
    if (status) { conditions.push('status = ?'); args.push(status) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await db.execute({
      sql: `SELECT * FROM pipeline_runs ${where} ORDER BY started_at DESC LIMIT 100`,
      args,
    })

    return NextResponse.json({ data: result.rows })
  } catch (err) {
    console.error('[GET /api/v1/pipeline/runs]', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch pipeline runs' } }, { status: 500 })
  }
}

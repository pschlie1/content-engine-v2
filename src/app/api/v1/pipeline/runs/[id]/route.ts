import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const result = await db.execute({
      sql: `SELECT pr.*, s.name as site_name, cp.name as pillar_name
            FROM pipeline_runs pr
            LEFT JOIN sites s ON pr.site_id = s.id
            LEFT JOIN content_pillars cp ON pr.pillar_id = cp.id
            WHERE pr.id = ?`,
      args: [id],
    })
    if (result.rows.length === 0) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Pipeline run not found' } }, { status: 404 })
    }
    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error(`[GET /api/v1/pipeline/runs/${id}]`, err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch pipeline run' } }, { status: 500 })
  }
}

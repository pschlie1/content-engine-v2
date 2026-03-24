import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/client'

const RejectSchema = z.object({
  reason: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body: unknown = await req.json().catch(() => ({}))
    const parsed = RejectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues } },
        { status: 400 }
      )
    }

    const check = await db.execute({ sql: `SELECT id, status FROM drafts WHERE id = ?`, args: [id] })
    if (check.rows.length === 0) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Draft not found' } }, { status: 404 })
    }

    const draft = check.rows[0] as { id: string; status: string }
    if (draft.status !== 'pending_review') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: `Cannot reject draft with status: ${draft.status}` } },
        { status: 422 }
      )
    }

    const now = new Date().toISOString()
    await db.execute({
      sql: `UPDATE drafts SET status = 'rejected', rejection_reason = ?, review_completed_at = ?, updated_at = ? WHERE id = ?`,
      args: [parsed.data.reason ?? null, now, now, id],
    })

    const result = await db.execute({ sql: `SELECT * FROM drafts WHERE id = ?`, args: [id] })
    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error(`[POST /api/v1/drafts/${id}/reject]`, err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to reject draft' } }, { status: 500 })
  }
}

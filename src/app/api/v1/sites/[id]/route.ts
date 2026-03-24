import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/client'

const UpdateSiteSchema = z.object({
  name: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
  github_repo: z.string().min(1).optional(),
  github_branch: z.string().optional(),
  publish_format: z.enum(['json', 'tsx', 'mdx']).optional(),
  json_output_path: z.string().nullable().optional(),
  tsx_output_path: z.string().nullable().optional(),
  mdx_output_path: z.string().optional(),
  tone_guidelines: z.string().optional(),
  product_context: z.string().nullable().optional(),
  audience_description: z.string().optional(),
  is_active: z.boolean().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const result = await db.execute({ sql: `SELECT * FROM sites WHERE id = ?`, args: [id] })
    if (result.rows.length === 0) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Site not found' } }, { status: 404 })
    }
    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error(`[GET /api/v1/sites/${id}]`, err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch site' } }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body: unknown = await req.json()
    const parsed = UpdateSiteSchema.safeParse(body)
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
    if (data.domain !== undefined) { fields.push('domain = ?'); args.push(data.domain) }
    if (data.github_repo !== undefined) { fields.push('github_repo = ?'); args.push(data.github_repo) }
    if (data.github_branch !== undefined) { fields.push('github_branch = ?'); args.push(data.github_branch) }
    if (data.publish_format !== undefined) { fields.push('publish_format = ?'); args.push(data.publish_format) }
    if (data.json_output_path !== undefined) { fields.push('json_output_path = ?'); args.push(data.json_output_path) }
    if (data.tsx_output_path !== undefined) { fields.push('tsx_output_path = ?'); args.push(data.tsx_output_path) }
    if (data.mdx_output_path !== undefined) { fields.push('mdx_output_path = ?'); args.push(data.mdx_output_path) }
    if (data.tone_guidelines !== undefined) { fields.push('tone_guidelines = ?'); args.push(data.tone_guidelines) }
    if (data.product_context !== undefined) { fields.push('product_context = ?'); args.push(data.product_context) }
    if (data.audience_description !== undefined) { fields.push('audience_description = ?'); args.push(data.audience_description) }
    if (data.is_active !== undefined) { fields.push('is_active = ?'); args.push(data.is_active ? 1 : 0) }

    if (fields.length === 0) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } }, { status: 400 })
    }

    fields.push('updated_at = ?')
    args.push(now)
    args.push(id)

    await db.execute({ sql: `UPDATE sites SET ${fields.join(', ')} WHERE id = ?`, args })
    const result = await db.execute({ sql: `SELECT * FROM sites WHERE id = ?`, args: [id] })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Site not found' } }, { status: 404 })
    }
    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error(`[PATCH /api/v1/sites/${id}]`, err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update site' } }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const check = await db.execute({ sql: `SELECT id FROM sites WHERE id = ?`, args: [id] })
    if (check.rows.length === 0) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Site not found' } }, { status: 404 })
    }
    await db.execute({ sql: `DELETE FROM sites WHERE id = ?`, args: [id] })
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    console.error(`[DELETE /api/v1/sites/${id}]`, err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete site' } }, { status: 500 })
  }
}

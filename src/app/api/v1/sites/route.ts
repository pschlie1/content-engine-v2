import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ulid } from 'ulid'
import { db } from '@/lib/db/client'

const CreateSiteSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  github_repo: z.string().min(1),
  github_branch: z.string().default('main'),
  publish_format: z.enum(['json', 'tsx', 'mdx']).default('json'),
  json_output_path: z.string().optional(),
  tsx_output_path: z.string().optional(),
  mdx_output_path: z.string().default('content/posts'),
  tone_guidelines: z.string().default(''),
  product_context: z.string().optional(),
  audience_description: z.string().default(''),
})

export async function GET() {
  try {
    const result = await db.execute(`SELECT * FROM sites ORDER BY created_at DESC`)
    return NextResponse.json({ data: result.rows })
  } catch (err) {
    console.error('[GET /api/v1/sites]', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch sites' } }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parsed = CreateSiteSchema.safeParse(body)
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
      sql: `INSERT INTO sites
        (id, name, domain, github_repo, github_branch, publish_format, json_output_path,
         tsx_output_path, mdx_output_path, tone_guidelines, product_context, audience_description,
         created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, data.name, data.domain, data.github_repo, data.github_branch, data.publish_format,
        data.json_output_path ?? null, data.tsx_output_path ?? null, data.mdx_output_path,
        data.tone_guidelines, data.product_context ?? null, data.audience_description, now, now,
      ],
    })

    const result = await db.execute({ sql: `SELECT * FROM sites WHERE id = ?`, args: [id] })
    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/v1/sites]', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create site' } }, { status: 500 })
  }
}

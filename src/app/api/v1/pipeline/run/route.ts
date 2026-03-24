import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runPipeline } from '@/lib/pipeline/orchestrator'

const RunPipelineSchema = z.object({
  site_id: z.string().optional(),
  pillar_id: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => ({}))
    const parsed = RunPipelineSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues } },
        { status: 400 }
      )
    }

    // Start pipeline in background (don't await the full run)
    const runId = await runPipeline(parsed.data.site_id, parsed.data.pillar_id)

    return NextResponse.json({ data: { run_id: runId, status: 'started' } }, { status: 202 })
  } catch (err) {
    console.error('[POST /api/v1/pipeline/run]', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to start pipeline' } }, { status: 500 })
  }
}

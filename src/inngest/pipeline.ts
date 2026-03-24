import { inngest } from './client'
import { runPipeline } from '@/lib/pipeline/orchestrator'

/** Daily scheduled pipeline — runs at 4 AM UTC for all sites */
export const dailyPipeline = inngest.createFunction(
  { id: 'content-engine.daily-pipeline', name: 'Daily Content Pipeline' },
  { cron: '0 4 * * *' },
  async ({ step }) => {
    const runId = await step.run('run-pipeline', async () => {
      return runPipeline()
    })
    return { runId }
  }
)

/** Manual pipeline trigger — accepts optional site_id and pillar_id */
export const manualPipeline = inngest.createFunction(
  { id: 'content-engine.manual-pipeline', name: 'Manual Content Pipeline' },
  { event: 'content-engine/pipeline.run' },
  async ({ event, step }) => {
    const { site_id, pillar_id } = event.data as { site_id?: string; pillar_id?: string }
    const runId = await step.run('run-pipeline', async () => {
      return runPipeline(site_id, pillar_id)
    })
    return { runId }
  }
)

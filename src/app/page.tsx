import { db } from '@/lib/db/client'
import SiteCard from '@/components/SiteCard'
import PipelineRunLog from '@/components/PipelineRunLog'
import RunPipelineButton from '@/components/RunPipelineButton'

interface SiteRow {
  id: string
  name: string
  domain: string
  github_repo: string
  publish_format: string
  is_active: number
}

interface PipelineRunRow {
  id: string
  site_id: string | null
  trigger_type: string
  status: string
  started_at: string
  completed_at: string | null
  stages_log: string
  site_name: string | null
}

interface DraftCountRow {
  site_id: string
  count: number
}

async function getSites(): Promise<SiteRow[]> {
  const result = await db.execute(`SELECT * FROM sites WHERE is_active = 1 ORDER BY name`)
  return result.rows as unknown as SiteRow[]
}

async function getDraftCounts(): Promise<Record<string, number>> {
  const result = await db.execute(
    `SELECT site_id, COUNT(*) as count FROM drafts WHERE status = 'pending_review' GROUP BY site_id`
  )
  const counts: Record<string, number> = {}
  for (const row of result.rows as unknown as DraftCountRow[]) {
    counts[row.site_id] = row.count
  }
  return counts
}

async function getRecentRuns(): Promise<PipelineRunRow[]> {
  const result = await db.execute({
    sql: `SELECT pr.*, s.name as site_name
          FROM pipeline_runs pr
          LEFT JOIN sites s ON pr.site_id = s.id
          ORDER BY pr.started_at DESC
          LIMIT 5`,
    args: [],
  })
  return result.rows as unknown as PipelineRunRow[]
}

export default async function DashboardPage() {
  const [sites, draftCounts, recentRuns] = await Promise.all([
    getSites(),
    getDraftCounts(),
    getRecentRuns(),
  ])

  const totalPending = Object.values(draftCounts).reduce((a, b) => a + b, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {totalPending} draft{totalPending !== 1 ? 's' : ''} pending review
          </p>
        </div>
        <RunPipelineButton />
      </div>

      {/* Sites */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Sites</h2>
        {sites.length === 0 ? (
          <p className="text-gray-500">No active sites. Run migrations and seed to get started.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                pendingDraftCount={draftCounts[site.id] ?? 0}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent Pipeline Runs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Recent Pipeline Runs</h2>
          <a href="/pipeline" className="text-sm text-[#2563EB] hover:underline">View all →</a>
        </div>
        {recentRuns.length === 0 ? (
          <p className="text-gray-500">No pipeline runs yet.</p>
        ) : (
          <div className="space-y-3">
            {recentRuns.map((run) => (
              <PipelineRunLog key={run.id} run={run} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

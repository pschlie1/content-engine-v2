import { db } from '@/lib/db/client'
import PipelineRunLog from '@/components/PipelineRunLog'
import RunPipelineButton from '@/components/RunPipelineButton'

interface PipelineRunRow {
  id: string
  site_id: string | null
  pillar_id: string | null
  trigger_type: string
  status: string
  stages_log: string
  started_at: string
  completed_at: string | null
  error_message: string | null
  site_name: string | null
  pillar_name: string | null
}

async function getPipelineRuns(): Promise<PipelineRunRow[]> {
  const result = await db.execute({
    sql: `SELECT pr.*, s.name as site_name, cp.name as pillar_name
          FROM pipeline_runs pr
          LEFT JOIN sites s ON pr.site_id = s.id
          LEFT JOIN content_pillars cp ON pr.pillar_id = cp.id
          ORDER BY pr.started_at DESC
          LIMIT 50`,
    args: [],
  })
  return result.rows as unknown as PipelineRunRow[]
}

function formatDuration(started: string, completed: string | null): string {
  if (!completed) return 'Running…'
  const ms = new Date(completed).getTime() - new Date(started).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60000)}m`
}

export default async function PipelinePage() {
  const runs = await getPipelineRuns()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Pipeline Runs</h1>
        <RunPipelineButton />
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No pipeline runs yet.</p>
          <p className="text-sm">Click "Run Pipeline" to start the first content discovery run.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Site</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trigger</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Started</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Stages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.map((run) => {
                const stages: unknown[] = JSON.parse(run.stages_log || '[]')
                return (
                  <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                          run.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : run.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            run.status === 'completed'
                              ? 'bg-green-500'
                              : run.status === 'failed'
                              ? 'bg-red-500'
                              : 'bg-yellow-500 animate-pulse'
                          }`}
                        />
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{run.site_name ?? 'All sites'}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{run.trigger_type}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDuration(run.started_at, run.completed_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{stages.length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

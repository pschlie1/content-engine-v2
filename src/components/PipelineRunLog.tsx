interface StageLog {
  stage: string
  status: 'success' | 'error'
  message: string
  timestamp: string
  details?: Record<string, unknown>
}

interface PipelineRun {
  id: string
  site_id: string | null
  trigger_type: string
  status: string
  stages_log: string
  started_at: string
  completed_at: string | null
  site_name?: string | null
  error_message?: string | null
}

interface Props {
  run: PipelineRun
  compact?: boolean
}

function formatDuration(started: string, completed: string | null): string {
  if (!completed) return 'running'
  const ms = new Date(completed).getTime() - new Date(started).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60000)}m`
}

export default function PipelineRunLog({ run, compact = false }: Props) {
  const stages: StageLog[] = JSON.parse(run.stages_log || '[]')

  const statusColor =
    run.status === 'completed'
      ? 'bg-green-100 text-green-700'
      : run.status === 'failed'
      ? 'bg-red-100 text-red-700'
      : 'bg-yellow-100 text-yellow-700'

  if (compact) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
            {run.status}
          </span>
          <span className="text-sm text-gray-700">{run.site_name ?? 'All sites'}</span>
          <span className="text-xs text-gray-400 capitalize">{run.trigger_type}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{stages.length} stages</span>
          <span>{formatDuration(run.started_at, run.completed_at)}</span>
          <span>{new Date(run.started_at).toLocaleTimeString()}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
            {run.status}
          </span>
          <span className="text-sm font-medium text-gray-700">{run.site_name ?? 'All sites'}</span>
          <span className="text-xs text-gray-400 capitalize">{run.trigger_type}</span>
        </div>
        <div className="text-xs text-gray-400">
          {new Date(run.started_at).toLocaleString()} · {formatDuration(run.started_at, run.completed_at)}
        </div>
      </div>

      {run.error_message && (
        <div className="mb-3 p-2 bg-red-50 text-red-700 text-xs rounded">
          {run.error_message}
        </div>
      )}

      {stages.length > 0 && (
        <div className="space-y-1.5">
          {stages.map((stage, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                  stage.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <div>
                <span className="font-medium text-gray-700">{stage.stage}</span>
                <span className="text-gray-400 ml-2">{stage.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

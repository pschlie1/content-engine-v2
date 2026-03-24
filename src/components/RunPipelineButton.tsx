'use client'

import { useState } from 'react'
import { Play, Loader2 } from 'lucide-react'

export default function RunPipelineButton({ siteId, pillarId }: { siteId?: string; pillarId?: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleRun = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/v1/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId, pillar_id: pillarId }),
      })
      const data = (await res.json()) as { data?: { run_id: string }; error?: { message: string } }
      if (data.data?.run_id) {
        setResult(`Pipeline started (run: ${data.data.run_id.slice(-8)})`)
      } else {
        setResult(data.error?.message ?? 'Unknown error')
      }
    } catch {
      setResult('Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-sm text-gray-500">{result}</span>
      )}
      <button
        onClick={handleRun}
        disabled={loading}
        className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        Run Pipeline
      </button>
    </div>
  )
}

import { db } from '@/lib/db/client'
import DraftCard from '@/components/DraftCard'

interface DraftRow {
  id: string
  title: string
  slug: string
  status: string
  site_id: string
  site_name: string
  site_domain: string
  pillar_name: string
  relevance_score: number | null
  source_url: string
  source_type: string
  content_check_violations: string
  created_at: string
}

const STATUS_TABS = ['all', 'pending_review', 'approved', 'rejected', 'published'] as const
type StatusTab = typeof STATUS_TABS[number]

const STATUS_LABELS: Record<StatusTab, string> = {
  all: 'All',
  pending_review: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
}

async function getDrafts(status: string): Promise<DraftRow[]> {
  const isAll = status === 'all'
  const result = await db.execute({
    sql: `SELECT d.id, d.title, d.slug, d.status, d.site_id, d.content_check_violations, d.created_at,
                 s.name as site_name, s.domain as site_domain,
                 cp.name as pillar_name,
                 ds.relevance_score, ds.source_url, ds.source_type
          FROM drafts d
          JOIN sites s ON d.site_id = s.id
          JOIN content_pillars cp ON d.pillar_id = cp.id
          JOIN discovered_stories ds ON d.story_id = ds.id
          ${isAll ? '' : 'WHERE d.status = ?'}
          ORDER BY d.created_at DESC
          LIMIT 100`,
    args: isAll ? [] : [status],
  })
  return result.rows as unknown as DraftRow[]
}

export default async function DraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const activeStatus: StatusTab = (STATUS_TABS.includes(params.status as StatusTab) ? params.status : 'pending_review') as StatusTab
  const drafts = await getDrafts(activeStatus)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Drafts</h1>

      {/* Status tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {STATUS_TABS.map((tab) => (
          <a
            key={tab}
            href={`/drafts?status=${tab}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeStatus === tab
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {STATUS_LABELS[tab]}
          </a>
        ))}
      </div>

      {/* Drafts list */}
      {drafts.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No drafts found.</p>
      ) : (
        <div className="space-y-3">
          {drafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} />
          ))}
        </div>
      )}
    </div>
  )
}

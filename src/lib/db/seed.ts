import { ulid } from 'ulid'
import { db } from './client'

async function seed(): Promise<void> {
  console.log('Seeding database...')
  const now = new Date().toISOString()

  // ── Site 1: Scantient ──────────────────────────────────────────────────────
  const scantientId = ulid()
  await db.execute({
    sql: `INSERT OR IGNORE INTO sites
      (id, name, domain, github_repo, github_branch, publish_format, tsx_output_path,
       tone_guidelines, product_context, audience_description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      scantientId,
      'Scantient',
      'scantient.com',
      'pschlie1/scantient',
      'main',
      'tsx',
      'src/app/(marketing)/blog',
      'Clear, simple language. Spartan and informative. Short, impactful sentences. Active voice. Practical, actionable insights. Use \'you\' and \'your\'. No em dashes. No semicolons. No hashtags. No markdown formatting in prose. No asterisks.',
      'Scantient is an external security scanner for AI-generated apps. No SDK required. Scans for exposed API keys, missing security headers, and auth bypass patterns. For IT leaders managing vibe-coded apps.',
      'IT leaders, CTOs, and engineering managers at mid-market companies responsible for AI-generated apps built with Cursor, Lovable, and Replit.',
      now,
      now,
    ],
  })
  console.log('✓ Seeded Scantient site')

  // Scantient Pillar 1: API Security
  const apiSecurityId = ulid()
  await db.execute({
    sql: `INSERT OR IGNORE INTO content_pillars
      (id, site_id, name, description, target_keywords, rss_feeds, subreddits,
       newsapi_queries, score_threshold, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      apiSecurityId,
      scantientId,
      'API Security',
      'API security vulnerabilities, scanning tools, OWASP API Top 10, auth patterns, rate limiting, security headers',
      JSON.stringify(['api security', 'api security scanner', 'owasp api top 10', 'security headers', 'exposed api keys']),
      JSON.stringify(['https://feeds.feedburner.com/TheHackersNews', 'https://www.darkreading.com/rss.xml']),
      JSON.stringify(['netsec', 'webdev', 'devops']),
      JSON.stringify(['API security vulnerabilities 2026', 'vibe coding security']),
      70,
      now,
      now,
    ],
  })
  console.log('✓ Seeded Scantient / API Security pillar')

  // Scantient Pillar 2: Vibe Coding Security
  const vibeCodingId = ulid()
  await db.execute({
    sql: `INSERT OR IGNORE INTO content_pillars
      (id, site_id, name, description, target_keywords, rss_feeds, subreddits,
       newsapi_queries, score_threshold, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      vibeCodingId,
      scantientId,
      'Vibe Coding Security',
      'Security risks in AI-generated code, Cursor/Lovable/Replit apps, shadow IT, IT governance for AI tools',
      JSON.stringify(['vibe coding security', 'ai generated code security', 'cursor security', 'shadow it governance']),
      JSON.stringify(['https://feeds.feedburner.com/TheHackersNews']),
      JSON.stringify(['ChatGPT', 'cursor_ai', 'LocalLLaMA']),
      JSON.stringify(['vibe coding security risks', 'AI generated app vulnerabilities']),
      70,
      now,
      now,
    ],
  })
  console.log('✓ Seeded Scantient / Vibe Coding Security pillar')

  // ── Site 2: MyBizGrade ────────────────────────────────────────────────────
  const mybizgradeId = ulid()
  await db.execute({
    sql: `INSERT OR IGNORE INTO sites
      (id, name, domain, github_repo, github_branch, publish_format, json_output_path,
       tone_guidelines, product_context, audience_description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      mybizgradeId,
      'MyBizGrade',
      'mybizgrade.com',
      'pschlie1/grademybiz',
      'main',
      'json',
      'content/blog',
      'Clear, simple language. Spartan and informative. Short, impactful sentences. Active voice. Practical, actionable insights. Use \'you\' and \'your\'. No em dashes. No semicolons. No banned words (can, may, just, very, really, actually, could, however, powerful, cutting-edge, remarkable, groundbreaking, etc.).',
      'MyBizGrade gives small businesses a free AI-powered grade of their online presence. Paid tier: $39 Pro report. Outcome: \'Know your real competitive position.\'',
      'Small business owners (accountants, contractors, restaurants, professional services) who want to improve their Google visibility and online reputation.',
      now,
      now,
    ],
  })
  console.log('✓ Seeded MyBizGrade site')

  // MyBizGrade Pillar 1: Local SEO
  const localSeoId = ulid()
  await db.execute({
    sql: `INSERT OR IGNORE INTO content_pillars
      (id, site_id, name, description, target_keywords, rss_feeds, subreddits,
       newsapi_queries, score_threshold, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      localSeoId,
      mybizgradeId,
      'Local SEO',
      'Google Business Profile optimization, local search ranking, Google reviews, NAP consistency, local citations for small businesses',
      JSON.stringify(['local seo', 'google business profile', 'google reviews', 'local search', 'small business seo']),
      JSON.stringify(['https://feeds.feedburner.com/SearchEngineLand', 'https://moz.com/feed']),
      JSON.stringify(['SEO', 'smallbusiness', 'Entrepreneur']),
      JSON.stringify(['local SEO 2026', 'Google Business Profile updates']),
      70,
      now,
      now,
    ],
  })
  console.log('✓ Seeded MyBizGrade / Local SEO pillar')

  // MyBizGrade Pillar 2: Online Reputation
  const onlineReputationId = ulid()
  await db.execute({
    sql: `INSERT OR IGNORE INTO content_pillars
      (id, site_id, name, description, target_keywords, rss_feeds, subreddits,
       newsapi_queries, score_threshold, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      onlineReputationId,
      mybizgradeId,
      'Online Reputation',
      'Review management, responding to negative reviews, building review volume, reputation monitoring for local businesses',
      JSON.stringify(['online reputation management', 'google reviews', 'review management', 'negative review response']),
      JSON.stringify(['https://moz.com/feed']),
      JSON.stringify(['smallbusiness', 'marketing', 'Entrepreneur']),
      JSON.stringify(['online reputation management small business', 'Google reviews 2026']),
      65,
      now,
      now,
    ],
  })
  console.log('✓ Seeded MyBizGrade / Online Reputation pillar')

  console.log('\nSeed complete!')
  console.log(`Sites: Scantient (${scantientId}), MyBizGrade (${mybizgradeId})`)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})

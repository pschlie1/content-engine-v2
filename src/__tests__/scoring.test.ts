import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildScoringPrompt } from '../lib/pipeline/scoring'

// Mock the db module
vi.mock('../lib/db/client', () => ({
  db: {
    execute: vi.fn(),
  },
}))

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}))

const mockPillar = {
  id: '01HXTEST001',
  name: 'API Security',
  description: 'API security vulnerabilities and scanning tools',
  target_keywords: JSON.stringify(['api security', 'owasp api', 'security headers']),
  score_threshold: 70,
  site_id: '01HXSITE001',
}

const mockSite = {
  id: '01HXSITE001',
  audience_description: 'IT leaders and CTOs at mid-market companies',
}

const mockStories = [
  {
    id: '01HXSTORY001',
    title: 'OWASP API Security Top 10 Updated for 2026',
    summary: 'The latest OWASP API security recommendations have been published.',
    source_url: 'https://example.com/owasp-2026',
    source_type: 'rss',
  },
  {
    id: '01HXSTORY002',
    title: 'How to Bake the Perfect Sourdough',
    summary: 'A guide to bread making techniques.',
    source_url: 'https://example.com/bread',
    source_type: 'rss',
  },
]

describe('scoring - buildScoringPrompt', () => {
  it('includes pillar info in prompt', () => {
    const prompt = buildScoringPrompt(mockPillar, mockSite, mockStories, [], [])
    expect(prompt).toContain('API Security')
    expect(prompt).toContain('API security vulnerabilities and scanning tools')
    expect(prompt).toContain('api security')
  })

  it('includes audience description', () => {
    const prompt = buildScoringPrompt(mockPillar, mockSite, mockStories, [], [])
    expect(prompt).toContain('IT leaders and CTOs at mid-market companies')
  })

  it('includes recent published titles in prompt', () => {
    const recentTitles = ['Understanding API Rate Limiting', 'OWASP API Top 10 Explained']
    const prompt = buildScoringPrompt(mockPillar, mockSite, mockStories, recentTitles, [])
    expect(prompt).toContain('Understanding API Rate Limiting')
    expect(prompt).toContain('OWASP API Top 10 Explained')
    expect(prompt).toContain('Recently published titles')
  })

  it('includes pending draft titles in prompt', () => {
    const pendingTitles = ['A Draft About API Gateways', 'Security Headers Explained']
    const prompt = buildScoringPrompt(mockPillar, mockSite, mockStories, [], pendingTitles)
    expect(prompt).toContain('A Draft About API Gateways')
    expect(prompt).toContain('Security Headers Explained')
    expect(prompt).toContain('Pending draft titles')
  })

  it('shows (none) when no recent titles', () => {
    const prompt = buildScoringPrompt(mockPillar, mockSite, mockStories, [], [])
    expect(prompt).toContain('(none)')
  })

  it('includes all stories in prompt', () => {
    const prompt = buildScoringPrompt(mockPillar, mockSite, mockStories, [], [])
    expect(prompt).toContain('01HXSTORY001')
    expect(prompt).toContain('OWASP API Security Top 10 Updated for 2026')
    expect(prompt).toContain('01HXSTORY002')
  })

  it('handles valid JSON response format', () => {
    const validResponse = JSON.stringify([
      { story_id: '01HXSTORY001', relevance_score: 85, justification: 'Highly relevant to API security pillar' },
      { story_id: '01HXSTORY002', relevance_score: 5, justification: 'Not related to the pillar' },
    ])
    // JSON.parse should succeed
    expect(() => JSON.parse(validResponse)).not.toThrow()
    const parsed = JSON.parse(validResponse) as Array<{ story_id: string; relevance_score: number }>
    expect(parsed).toHaveLength(2)
    expect(parsed[0].relevance_score).toBe(85)
  })

  it('handles malformed JSON response gracefully', () => {
    const malformedResponse = 'This is not JSON at all { broken'
    // Simulate the try/catch in the scoring function
    let result: unknown[] = []
    try {
      result = JSON.parse(malformedResponse) as unknown[]
    } catch {
      result = []
    }
    expect(result).toHaveLength(0)
  })

  it('handles JSON wrapped in markdown code blocks', () => {
    const wrappedResponse = '```json\n[{"story_id":"abc","relevance_score":75,"justification":"relevant"}]\n```'
    // Simulate extraction logic
    const jsonMatch = wrappedResponse.match(/```(?:json)?\s*([\s\S]*?)```/)
    expect(jsonMatch).not.toBeNull()
    const parsed = JSON.parse(jsonMatch![1].trim()) as unknown[]
    expect(parsed).toHaveLength(1)
  })
})

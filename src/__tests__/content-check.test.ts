import { describe, it, expect } from 'vitest'
import { checkContent } from '../lib/pipeline/content-check'

describe('content-check', () => {
  it('clean content passes (no violations)', () => {
    const markdown = `## How to Improve Your Website

Start with a clear goal. Write short sentences. Use active voice.

Focus on what your audience needs.`
    const result = checkContent(markdown)
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('detects em dash (—)', () => {
    const markdown = `This is a test — with an em dash.`
    const result = checkContent(markdown)
    expect(result.passed).toBe(false)
    const emDashes = result.violations.filter((v) => v.type === 'em_dash')
    expect(emDashes.length).toBeGreaterThan(0)
    expect(emDashes[0].line).toBe(1)
  })

  it('detects double dash (--) as em dash', () => {
    const markdown = `This is a test -- with a double dash.`
    const result = checkContent(markdown)
    expect(result.passed).toBe(false)
    const emDashes = result.violations.filter((v) => v.type === 'em_dash')
    expect(emDashes.length).toBeGreaterThan(0)
  })

  it('detects semicolons in prose', () => {
    const markdown = `First point; second point.`
    const result = checkContent(markdown)
    expect(result.passed).toBe(false)
    const semis = result.violations.filter((v) => v.type === 'semicolon')
    expect(semis.length).toBeGreaterThan(0)
    expect(semis[0].line).toBe(1)
  })

  it('detects banned word (case insensitive)', () => {
    const markdown = `This is actually a good idea. We should revolutionize the approach.`
    const result = checkContent(markdown)
    expect(result.passed).toBe(false)
    const banned = result.violations.filter((v) => v.type === 'banned_word')
    expect(banned.length).toBeGreaterThan(0)
    const words = banned.map((v) => v.word)
    expect(words).toContain('actually')
    expect(words).toContain('revolutionize')
  })

  it('detects banned word regardless of case', () => {
    const markdown = `JUST do it. Just try it.`
    const result = checkContent(markdown)
    const banned = result.violations.filter((v) => v.type === 'banned_word' && v.word === 'just')
    expect(banned.length).toBeGreaterThanOrEqual(2)
  })

  it('detects multiple violations in one document', () => {
    const markdown = `## Introduction — An Overview

This is actually very important; it can be groundbreaking.

We should utilize this approach to boost results.`
    const result = checkContent(markdown)
    expect(result.passed).toBe(false)
    expect(result.violations.length).toBeGreaterThan(3)
    const types = result.violations.map((v) => v.type)
    expect(types).toContain('em_dash')
    expect(types).toContain('semicolon')
    expect(types).toContain('banned_word')
  })

  it('does not flag banned words inside code blocks', () => {
    const markdown = `Here is some code:

\`\`\`javascript
// This is actually a comment
const power = 'powerful function'
function discover() {}
\`\`\`

The above code is clean.`
    const result = checkContent(markdown)
    // Should not find banned words from inside the code block
    const bannedInCode = result.violations.filter(
      (v) => v.type === 'banned_word' && (v.line === 4 || v.line === 5 || v.line === 6)
    )
    expect(bannedInCode).toHaveLength(0)
  })

  it('reports correct line numbers for violations', () => {
    const markdown = `## Clean heading

This line is fine.

This line has an em dash — right here.

This line is also fine.`
    const result = checkContent(markdown)
    const emDash = result.violations.find((v) => v.type === 'em_dash')
    expect(emDash?.line).toBe(5)
  })
})

export type ViolationType = 'em_dash' | 'semicolon' | 'banned_word'

export interface Violation {
  type: ViolationType
  word?: string
  line: number
  text: string
}

export interface ContentCheckResult {
  passed: boolean
  violations: Violation[]
}

const BANNED_WORDS = [
  'can',
  'may',
  'just',
  'that',
  'very',
  'really',
  'literally',
  'actually',
  'certainly',
  'probably',
  'basically',
  'could',
  'maybe',
  'delve',
  'embark',
  'enlightening',
  'esteemed',
  'shed light',
  'craft',
  'crafting',
  'imagine',
  'realm',
  'game-changer',
  'unlock',
  'discover',
  'skyrocket',
  'abyss',
  'not alone',
  'in a world where',
  'revolutionize',
  'disruptive',
  'utilize',
  'utilizing',
  'dive deep',
  'tapestry',
  'illuminate',
  'unveil',
  'pivotal',
  'intricate',
  'elucidate',
  'hence',
  'furthermore',
  'however',
  'harness',
  'exciting',
  'groundbreaking',
  'cutting-edge',
  'remarkable',
  'remains to be seen',
  'glimpse into',
  'navigating',
  'landscape',
  'stark',
  'testament',
  'in summary',
  'in conclusion',
  'moreover',
  'boost',
  'powerful',
  'inquiries',
  'ever-evolving',
]

/**
 * Strip code blocks from content before checking banned words.
 * Code fences (``` ... ```) and inline code (` ... `) are excluded.
 */
function stripCodeBlocks(text: string): string {
  // Remove fenced code blocks
  let stripped = text.replace(/```[\s\S]*?```/g, (match) => {
    // Replace with same number of newlines to preserve line numbers
    return match.replace(/[^\n]/g, ' ')
  })
  // Remove inline code
  stripped = stripped.replace(/`[^`]*`/g, (match) => match.replace(/[^`\n]/g, ' '))
  return stripped
}

export function checkContent(bodyMarkdown: string): ContentCheckResult {
  const violations: Violation[] = []
  const lines = bodyMarkdown.split('\n')
  const strippedLines = stripCodeBlocks(bodyMarkdown).split('\n')

  // Check each line for em dashes and semicolons (in original lines)
  lines.forEach((line, idx) => {
    const lineNum = idx + 1

    // Em dashes: — or --
    const emDashMatches = [...line.matchAll(/—|--/g)]
    for (const match of emDashMatches) {
      violations.push({
        type: 'em_dash',
        line: lineNum,
        text: line.trim(),
      })
    }

    // Semicolons in prose
    const semicolonMatches = [...line.matchAll(/;/g)]
    for (const match of semicolonMatches) {
      violations.push({
        type: 'semicolon',
        line: lineNum,
        text: line.trim(),
      })
    }
  })

  // Check banned words against stripped content (no code blocks)
  strippedLines.forEach((strippedLine, idx) => {
    const lineNum = idx + 1
    const originalLine = lines[idx]

    for (const word of BANNED_WORDS) {
      // Escape special regex chars in multi-word phrases
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // For multi-word phrases, don't use word boundary at edges that aren't word chars
      const pattern = word.includes(' ')
        ? new RegExp(escaped, 'gi')
        : new RegExp(`\\b${escaped}\\b`, 'gi')

      const matches = [...strippedLine.matchAll(pattern)]
      for (const _match of matches) {
        violations.push({
          type: 'banned_word',
          word,
          line: lineNum,
          text: originalLine.trim(),
        })
      }
    }
  })

  return {
    passed: violations.length === 0,
    violations,
  }
}

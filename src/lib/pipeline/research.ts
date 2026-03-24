import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ResearchBrief {
  key_facts: string[]
  statistics: Array<{ stat: string; source: string }>
  additional_context: string
  related_angles: string[]
}

interface Story {
  id: string
  title: string
  summary: string
  source_url: string
}

export async function researchStory(story: Story): Promise<ResearchBrief> {
  console.log(`[research] Researching: ${story.title}`)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: 'Research the following story for a blog post. Find additional data points, statistics, expert perspectives, and related context. Return a JSON object with: key_facts (array of strings), statistics (array of {stat, source}), additional_context (string), related_angles (array of strings). Return JSON only.',
      messages: [
        {
          role: 'user',
          content: `Story title: ${story.title}
Source URL: ${story.source_url}
Summary: ${story.summary}

Research this topic thoroughly and return a JSON research brief.`,
        },
      ],
      tools: [
        {
          name: 'web_search',
          description: 'Search the web for information about a topic',
          input_schema: {
            type: 'object' as const,
            properties: {
              query: {
                type: 'string',
                description: 'The search query',
              },
            },
            required: ['query'],
          },
        },
      ],
    })

    // Extract the final text response
    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from research agent')
    }

    const brief = JSON.parse(textBlock.text) as ResearchBrief
    return brief
  } catch (err) {
    console.error(`[research] Error researching story ${story.id}:`, err)
    // Return empty brief on failure — don't block drafting
    return {
      key_facts: [],
      statistics: [],
      additional_context: '',
      related_angles: [],
    }
  }
}

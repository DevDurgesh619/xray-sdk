// LLM reasoning generator
import { Step } from "../types"

export type ReasoningGenerator = (step: Step) => Promise<string>

/**
 * Default reasoning generator using OpenAI
 * Users can provide their own OpenAI client instance
 */
export function createOpenAIGenerator(openaiClient: any): ReasoningGenerator {
  return async (step: Step): Promise<string> => {
    console.log(`[XRay LLM] 🚀 Generating reasoning for step: ${step.name}`)

    // Try numeric reasoning first (free, fast)
    const numericReasoning = generateNumericReasoning(step)
    if (numericReasoning) {
      console.log(`[XRay LLM] ✓ Using numeric reasoning: "${numericReasoning}"`)
      return numericReasoning
    }

    // Handle errors
    if (step.error) {
      return `❌ ${step.name} failed: ${step.error}`
    }

    try {
      const prompt = `You are an AI pipeline observability expert. Generate a concise 1-2 sentence explanation for this step.

Input: ${JSON.stringify(step.input ?? {})}

Output: ${JSON.stringify(step.output ?? {})}

Rules:
- Be specific and mention counts, thresholds, or key decisions
- Use neutral, technical language
- Do NOT restate raw data verbatim
- ONLY return the reasoning text, no JSON formatting

Reasoning:`

      console.log(`[XRay LLM] 📤 Sending request to OpenAI API...`)
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.1,
      })
      console.log(`[XRay LLM] ✓ Received response from OpenAI API`)

      const rawResponse = completion.choices[0]?.message?.content?.trim() || "Step processed"
      console.log(`[XRay LLM] 📝 Raw response (${rawResponse.length} chars): "${rawResponse}"`)

      // Clean up the response
      let reasoning = rawResponse
        .replace(/^Reasoning:\s*/i, '')
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim()

      // If response looks like truncated JSON, return fallback
      if (reasoning.startsWith('{') && !reasoning.endsWith('}')) {
        console.log(`[XRay LLM] ⚠️  Detected truncated JSON response, using fallback`)
        const fallback = generateNumericReasoning(step) || `Processed ${step.name}`
        console.log(`[XRay LLM] ✓ Using fallback: "${fallback}"`)
        return fallback
      }

      console.log(`[XRay LLM] ✅ Final reasoning (${reasoning.length} chars): "${reasoning}"`)
      return reasoning
    } catch (error: any) {
      console.error(`[XRay LLM] ❌ OpenAI API failed for step ${step.name}:`, error.message)
      const fallback = generateNumericReasoning(step) || `✅ ${step.name} processed`
      console.log(`[XRay LLM] ✓ Using fallback: "${fallback}"`)
      return fallback
    }
  }
}

/**
 * Simple reasoning generator (no LLM)
 * Returns numeric summaries based on step data
 */
export function createSimpleGenerator(): ReasoningGenerator {
  return async (step: Step): Promise<string> => {
    if (step.error) {
      return `❌ ${step.name} failed: ${step.error}`
    }

    const numericReasoning = generateNumericReasoning(step)
    if (numericReasoning) {
      return numericReasoning
    }

    return `✅ ${step.name} processed (${step.durationMs ?? 0}ms)`
  }
}

function generateNumericReasoning(step: Step): string | null {
  const input = step.input ?? {}
  const output = step.output ?? {}

  // Ranking/Selection steps
  if (output.ranked_candidates && output.selection) {
    const count = output.ranked_candidates?.length ?? 0
    const selectionTitle = output.selection?.title ?? output.selection?.asin ?? 'top choice'
    return `Ranked ${count} candidate(s) and selected "${selectionTitle}" as top choice`
  }

  // Filter pass/fail
  const total = output.total_evaluated ?? output.total_evaluated ?? output.evaluated?.length
  const passed = output.passed ?? output.accepted ?? output.remaining?.length
  if (total && passed !== undefined) {
    return `📊 ${passed}/${total} passed`
  }

  // Search results
  const found = output.total_results ?? output.total_found ?? output.total
  const returned = output.candidates_fetched ?? output.candidates?.length
  if (found && returned) {
    return `🔍 ${found}→${returned} results`
  }

  // Size change (only if different)
  const inputCount = getArrayLength(input)
  const outputCount = getArrayLength(output)
  if (inputCount && outputCount && inputCount !== outputCount) {
    return `🔄 ${inputCount}→${outputCount} items`
  }

  return null
}

function getArrayLength(obj: any): number | null {
  if (Array.isArray(obj)) return obj.length
  return obj?.candidates?.length ?? obj?.items?.length ?? obj?.remaining?.length ?? obj?.ranked_candidates?.length ?? null
}

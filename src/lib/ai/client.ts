import Anthropic from "@anthropic-ai/sdk";

/** Model used for syllabus and grade extraction. */
export const MODEL = "claude-opus-5-5";

export class AiError extends Error {}

let client: Anthropic | null = null;

/** Server-only. Reads ANTHROPIC_API_KEY (or an `ant auth login` profile) from the environment. */
export function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

/**
 * Turn SDK errors into messages a student can act on.
 * Checked most specific first.
 */
export function explainAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new AiError("The Anthropic API key is missing or wrong. Check ANTHROPIC_API_KEY in .env.local.");
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError("This API key isn't allowed to use the model. Check your Anthropic Console account.");
  if (e instanceof Anthropic.RateLimitError) return new AiError("Too many requests to the Claude API right now. Wait a minute and try again.");
  if (e instanceof Anthropic.BadRequestError) return new AiError(`The Claude API rejected the request: ${e.message}`);
  if (e instanceof Anthropic.APIConnectionError) return new AiError("Couldn't reach the Claude API. Check your internet connection.");
  if (e instanceof Anthropic.APIError) return new AiError(`Claude API error (${e.status}). Try again in a moment.`);
  if (e instanceof Error && /api key|apiKey|authentication/i.test(e.message)) {
    return new AiError("No Anthropic API key found. Add ANTHROPIC_API_KEY to .env.local and restart.");
  }
  return new AiError("Something went wrong reading that file. Try again.");
}

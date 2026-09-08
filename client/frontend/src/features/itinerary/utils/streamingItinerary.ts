import type { GeneratedActivity } from '@explivio/shared';

export interface PartialItinerary {
  summary: string | null;
  activities: GeneratedActivity[];
  complete: boolean;
}

// F13: parse an in-progress structured-JSON stream from the itinerary generation hub. The model
// streams a single JSON object ({ summary, activities: [...] }) token-by-token, so mid-stream the
// text is not yet valid JSON. This extracts whatever is already complete — the summary once its
// string closes, and each activity object once its braces balance — so the UI can reveal cards one
// by one as they arrive. When the whole payload parses, `complete` is true.
export function parsePartialItinerary(text: string): PartialItinerary {
  // Fast path: the full object is already valid JSON.
  try {
    const full = JSON.parse(text) as { summary?: string; activities?: GeneratedActivity[] };
    return {
      summary: full.summary ?? null,
      activities: full.activities ?? [],
      complete: true,
    };
  } catch {
    // Still streaming — fall through to best-effort extraction.
  }

  return {
    summary: extractSummary(text),
    activities: extractCompleteActivities(text),
    complete: false,
  };
}

// Pull the summary value once its closing quote has arrived. The capture matches a full JSON string
// (handling escaped quotes); re-parsing it via JSON unescapes it correctly.
function extractSummary(text: string): string | null {
  const match = text.match(/"summary"\s*:\s*("(?:[^"\\]|\\.)*")/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as string;
  } catch {
    return null;
  }
}

// Walk the activities array and return every object whose braces balance (a complete activity);
// the trailing, still-streaming object is skipped until it closes.
function extractCompleteActivities(text: string): GeneratedActivity[] {
  const key = text.indexOf('"activities"');
  if (key === -1) return [];

  const arrayStart = text.indexOf('[', key);
  if (arrayStart === -1) return [];

  const activities: GeneratedActivity[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = arrayStart + 1; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        const slice = text.slice(objStart, i + 1);
        try {
          activities.push(JSON.parse(slice) as GeneratedActivity);
        } catch {
          // Malformed slice — ignore and keep scanning.
        }
        objStart = -1;
      }
    } else if (ch === ']' && depth === 0) {
      break; // end of the activities array
    }
  }

  return activities;
}

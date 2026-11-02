/** Parse data only; tolerate a single Markdown fence, never evaluate model code. */
export function parseModelJson(text){const value=String(text).trim(),fence=value.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);return JSON.parse(fence?fence[1]:value);}

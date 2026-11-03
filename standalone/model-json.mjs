/** Parse data only. Never evaluate code or change a model's technical values. */
export function parseModelJson(text) {
  const value = String(text).trim().replace(/^`{1,3}(?:json)?\s*/i, '').replace(/\s*`{1,3}$/, '');
  try { return JSON.parse(value); } catch (original) {
    // Qwen vision sometimes stops immediately before/after the outer object brace.
    // Only repair that one delimiter; strings, arrays, nested data and prose stay strict.
    if (value.startsWith('{')) {
      if (value.endsWith('}}')) {
        try { return JSON.parse(value.slice(0, -1)); } catch {}
      }
      const stack = [];
      let quoted = false, escaped = false, invalid = false;
      for (const c of value) {
        if (quoted) {
          if (escaped) escaped = false;
          else if (c === '\\') escaped = true;
          else if (c === '"') quoted = false;
        } else if (c === '"') quoted = true;
        else if (c === '{' || c === '[') stack.push(c);
        else if (c === '}' || c === ']') {
          if (stack.pop() !== (c === '}' ? '{' : '[')) { invalid = true; break; }
        }
      }
      if (!invalid && !quoted && stack.length === 1 && stack[0] === '{' && /[\]}]$/.test(value)) {
        try { return JSON.parse(value + '}'); } catch {}
      }
    }
    throw original;
  }
}
export function structuredPrompt(prompt, schema) {
  return prompt + '\n\nREQUIRED OUTPUT JSON SCHEMA:\n' + JSON.stringify(schema) + '\nReturn exactly one JSON object using these required keys and types. Use [] for empty arrays, never [null]. Close the outer object with one }. No Markdown fences, commentary, alternative key names or wrapper objects.';
}

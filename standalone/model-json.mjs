/** Parse data only; tolerate a single Markdown fence, never evaluate model code. */
export function parseModelJson(text){const value=String(text).trim().replace(/^`{1,3}(?:json)?\s*/i,'').replace(/\s*`{1,3}$/,'');return JSON.parse(value);}
export function structuredPrompt(prompt,schema){return prompt+'\n\nREQUIRED OUTPUT JSON SCHEMA:\n'+JSON.stringify(schema)+'\nReturn exactly one JSON object using these required keys and types. No Markdown fences, commentary, alternative key names or wrapper objects.';}

// JSON merge patch (RFC 7396), as every node applies PATCH bodies: objects merge member by
// member, `null` removes a member, anything else (arrays included) replaces it.
// `replace` names members that are swapped wholesale instead (an asset's `files`).
type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

export function mergePatch(target: unknown, patch: unknown, replace: readonly string[] = []): unknown {
  if (!isObject(patch)) return patch
  const out: Json = isObject(target) ? { ...target } : {}
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k]
    else if (replace.includes(k)) out[k] = v
    else out[k] = mergePatch(out[k], v, replace)
  }
  return out
}

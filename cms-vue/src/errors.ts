/**
 * Server errors arrive keyed by field path ("hours.2.opens"). Each nested
 * editor gets the errors under its own path, re-keyed relative to it ("" for
 * the field itself).
 */
export function errorsUnder(errors: Record<string, string>, prefix: string) {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([path]) => path === prefix || path.startsWith(`${prefix}.`))
      .map(([path, message]) => [path.slice(prefix.length + 1), message])
  )
}

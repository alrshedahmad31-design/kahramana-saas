// Sanitize search input before interpolating into a PostgREST `.or()`
// expression with `ilike`. The .or() DSL is comma-delimited and uses
// `(` `)` `:` `,` as structural tokens — passing unfiltered user input
// allows predicate widening / filter bypass. ilike's own wildcards
// (`%`, `_`, `\`) are escaped so the match stays literal.
export function escapeSearch(input: string): string {
  return input
    .replace(/[\\%_]/g, '\\$&')
    .replace(/[,():"]/g, '')
}

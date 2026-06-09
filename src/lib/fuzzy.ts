import Fuse from 'fuse.js'

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// Token-set match: "hp 24f" matches "Monitor HP 24F 23.8""
export function fuzzyScore(query: string, candidate: string): number {
  const q = normalizeName(query).split(' ').filter(Boolean)
  const c = normalizeName(candidate)
  const matched = q.filter(token => c.includes(token))
  return matched.length / q.length
}

export function isDuplicate(newName: string, existingNames: string[]): string | null {
  const norm = normalizeName(newName)
  for (const existing of existingNames) {
    if (fuzzyScore(norm, existing) >= 0.8) return existing
  }
  return null
}

export function buildFuseIndex<T extends { name: string; norm_name?: string }>(items: T[]) {
  return new Fuse(items, {
    keys: ['name', 'norm_name', 'cat'],
    threshold: 0.4,
    includeScore: true,
    useExtendedSearch: true,
  })
}

export function fuseSearch<T extends { name: string; norm_name?: string }>(
  fuse: Fuse<T>,
  query: string
): T[] {
  if (!query.trim()) return []
  return fuse.search(query).map(r => r.item)
}

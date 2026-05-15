export function formatMemberId(uuid: string): string {
  return `KAH-${uuid.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

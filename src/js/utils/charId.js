export function normaliseCharId(id) {
  return id
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-');
}

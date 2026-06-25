export function buildZoneUrl(path: string, zoneId?: string | null): string {
  if (!zoneId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}zone=${zoneId}`;
}

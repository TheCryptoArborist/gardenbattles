export function appRoute(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.replace(/\/$/, "");
  const normalizedPath = path.replace(/^\//, "");

  return normalizedBase
    ? `${normalizedBase}/${normalizedPath}`
    : `/${normalizedPath}`;
}

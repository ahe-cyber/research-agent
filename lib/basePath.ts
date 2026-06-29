const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function withBasePath(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${basePath}${path}`;
}

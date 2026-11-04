/**
 * The path (with query and hash) of a router location — what the OIDC login
 * carries as `returnTo`, so a login started from e.g. the Alexa consent page
 * comes back to it (Phase 8). `undefined` keeps the default landing page.
 */
export function toReturnToPath(
  location: { pathname: string; search?: string; hash?: string } | undefined,
): string | undefined {
  return location
    ? `${location.pathname}${location.search ?? ''}${location.hash ?? ''}`
    : undefined;
}

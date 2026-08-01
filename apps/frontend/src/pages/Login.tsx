/**
 * Placeholder login screen. Real local + OIDC auth lands in Phase 1.
 *
 * Not migrated to `useTranslation()`/i18n resource keys here — this
 * placeholder is about to be fully rewritten by the next sub-step (local
 * login/registration UI), so wiring it now would be pure churn. That
 * sub-step is expected to introduce its own i18n keys directly.
 */
export function Login() {
  return (
    <section>
      <h1>Login</h1>
      <p>Local and OIDC login will be implemented in Phase 1.</p>
    </section>
  );
}

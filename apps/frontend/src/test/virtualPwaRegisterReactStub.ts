/**
 * Resolution target for the `virtual:pwa-register/react` alias in
 * vitest.config.ts. The real module only exists via vite-plugin-pwa's Vite
 * plugin (not registered for the Vitest config), so without an alias Vite's
 * import analysis fails to resolve the bare specifier before any `vi.mock`
 * call gets a chance to intercept it. Individual specs still override this
 * via `vi.mock('virtual:pwa-register/react', ...)`; this stub only exists so
 * an unmocked import doesn't crash the whole module graph.
 */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async () => {},
  };
}

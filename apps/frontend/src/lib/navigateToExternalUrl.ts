/**
 * Full-page navigation to another origin (e.g. back to the Alexa app after
 * account linking). Its own module so specs can mock it — jsdom does not
 * implement navigation.
 */
export function navigateToExternalUrl(url: string): void {
  window.location.assign(url);
}

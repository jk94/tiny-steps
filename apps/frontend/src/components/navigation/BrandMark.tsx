import { Footprints } from 'lucide-react';

/**
 * The app's logo mark: two little footprints ("tiny steps") on the brand
 * gradient. Decorative — the visible "TinySteps" wordmark next to it carries
 * the name.
 */
export function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 items-center justify-center rounded-md bg-[linear-gradient(135deg,var(--color-primary),var(--color-milestone))] text-primary-foreground shadow-md"
    >
      <Footprints className="h-5 w-5 -rotate-12" strokeWidth={2.5} />
    </span>
  );
}

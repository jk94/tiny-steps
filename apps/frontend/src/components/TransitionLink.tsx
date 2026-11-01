import type { MouseEvent } from 'react';
import { Link, useNavigate, type LinkProps } from 'react-router';
import { canUseViewTransitions, navigateWithViewTransition } from '../lib/viewTransition';

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;
}

/**
 * A router `<Link>` whose navigation runs inside a View Transition (see
 * `lib/viewTransition.ts`), so elements carrying a matching
 * `view-transition-name` on both pages morph into each other.
 *
 * It stays a real link — `href`, middle-click, modifier-click "open in new
 * tab" and keyboard activation all behave natively; only a plain left click
 * (or Enter) in a browser that supports the API is taken over.
 */
export function TransitionLink({ to, replace, state, onClick, target, ...props }: LinkProps) {
  const navigate = useNavigate();

  return (
    <Link
      to={to}
      replace={replace}
      state={state}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          !isPlainLeftClick(event) ||
          (target && target !== '_self') ||
          !canUseViewTransitions()
        ) {
          return;
        }
        event.preventDefault();
        navigateWithViewTransition(() => void navigate(to, { replace, state }));
      }}
      {...props}
    />
  );
}

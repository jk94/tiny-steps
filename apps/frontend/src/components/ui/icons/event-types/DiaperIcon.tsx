import { EventTypeIconBase, type EventTypeIconProps } from './EventTypeIconBase';

/** Diaper: a waistband over a tapering diaper body. */
export function DiaperIcon(props: EventTypeIconProps) {
  return (
    <EventTypeIconBase {...props}>
      <path d="M4 5h16v4c0 5-3.4 9-8 9s-8-4-8-9V5z" />
      <path d="M4 9c4.5 1.6 11.5 1.6 16 0" />
    </EventTypeIconBase>
  );
}

import { EventTypeIconBase, type EventTypeIconProps } from './EventTypeIconBase';

/** Breastfeeding: a milk droplet inside a circle. */
export function BreastfeedingIcon(props: EventTypeIconProps) {
  return (
    <EventTypeIconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7c-1.6 2.1-3 3.7-3 5.3a3 3 0 0 0 6 0c0-1.6-1.4-3.2-3-5.3z" />
    </EventTypeIconBase>
  );
}

import { EventTypeIconBase, type EventTypeIconProps } from './EventTypeIconBase';

/** Solid food (Beikost): a feeding bowl with a spoon. */
export function SolidFoodIcon(props: EventTypeIconProps) {
  return (
    <EventTypeIconBase {...props}>
      <path d="M3 11h15" />
      <path d="M4 11a7 7 0 0 0 13 0" />
      <path d="M20 4v7" />
      <path d="M20 4a2 2 0 0 0-2 2v3h4V6a2 2 0 0 0-2-2z" />
    </EventTypeIconBase>
  );
}

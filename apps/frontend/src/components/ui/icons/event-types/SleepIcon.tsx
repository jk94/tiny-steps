import { EventTypeIconBase, type EventTypeIconProps } from './EventTypeIconBase';

/** Sleep: a crescent moon. */
export function SleepIcon(props: EventTypeIconProps) {
  return (
    <EventTypeIconBase {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
    </EventTypeIconBase>
  );
}

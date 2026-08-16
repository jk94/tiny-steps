import { EventTypeIconBase, type EventTypeIconProps } from './EventTypeIconBase';

/** Bottle feeding: a baby bottle with a nipple, collar and measurement lines. */
export function BottleIcon(props: EventTypeIconProps) {
  return (
    <EventTypeIconBase {...props}>
      <path d="M10 2h4" />
      <path d="M10.5 5.5h3" />
      <path d="M10 2v1.6c0 .6-.3 1.2-.7 1.6-.5.5-.8 1.1-.8 1.8V20a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V8.6c0-.7-.3-1.3-.8-1.8-.4-.4-.7-1-.7-1.6V2" />
      <path d="M9 11h6" />
      <path d="M9 14h6" />
    </EventTypeIconBase>
  );
}

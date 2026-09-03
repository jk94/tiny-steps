import { EventTypeIconBase, type EventTypeIconProps } from '../event-types/EventTypeIconBase';

/** Medication: a two-tone capsule lying on its diagonal, with the seam marked. */
export function MedicationIcon(props: EventTypeIconProps) {
  return (
    <EventTypeIconBase {...props}>
      <path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l6-6a4.95 4.95 0 0 1 7 7z" />
      <path d="M6.5 10.5l7 7" />
    </EventTypeIconBase>
  );
}

import { EventTypeIconBase, type EventTypeIconProps } from '../event-types/EventTypeIconBase';

/**
 * Vaccination: a syringe on the 45° diagonal, needle pointing down-left —
 * barrel, plunger rod with its thumb rest, and one graduation mark.
 */
export function VaccinationIcon(props: EventTypeIconProps) {
  return (
    <EventTypeIconBase {...props}>
      {/* Barrel: a rectangle rotated 45°, drawn corner to corner. */}
      <path d="M6.2 17.8 9.8 14.2 18.8 5.2 15.2 8.8Z" />
      {/* Needle, from the middle of the barrel's lower end. */}
      <path d="M8 16 3.5 20.5" />
      {/* Plunger rod out of the upper end, ending in its thumb rest. */}
      <path d="M17 7 20 4" />
      <path d="M18.5 2.5 21.5 5.5" />
      {/* Graduation mark across the barrel. */}
      <path d="M10.4 12.6 13.4 15.6" />
    </EventTypeIconBase>
  );
}

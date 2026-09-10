/**
 * Field limits for milestones, shared by the create and update DTOs.
 *
 * The frontend mirrors these in `apps/frontend/src/lib/milestoneLimits.ts`;
 * any change here has to be made there too.
 */

/**
 * A milestone title is a headline ("Erstes Lächeln"), not a story — the note
 * field below is where a longer memory belongs. Generous enough for the
 * longest catalog label in either language plus a parent's own phrasing.
 */
export const MAX_MILESTONE_TITLE_LENGTH = 200;

/** Same ceiling as a growth measurement's note, for one consistent limit. */
export const MAX_NOTE_LENGTH = 500;

/**
 * Client-side field limits for milestones, for fast feedback before hitting
 * the server. Intentionally mirrors
 * `apps/backend/src/milestone/milestone.constants.ts` by value — duplicated,
 * not imported, since the frontend and backend are separate packages with no
 * shared-code boundary today. The server remains the authority.
 */
export const MAX_MILESTONE_TITLE_LENGTH = 200;

export const MAX_NOTE_LENGTH = 500;

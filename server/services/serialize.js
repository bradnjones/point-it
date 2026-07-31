/**
 * Shapes DB rows for the client. Critically, this is where the facilitator
 * token is stripped — it must never reach any client except the one that
 * created the session (which receives it directly from the create response).
 */
export function serializeSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    code: session.code,
    name: session.name,
    mode: session.mode,
    scale: session.scale,
    activeStoryId: session.active_story_id ?? null,
    createdAt: session.created_at,
    closedAt: session.closed_at,
  };
}

export function serializeParticipant(participant, connected = false) {
  return {
    id: participant.id,
    displayName: participant.display_name,
    isFacilitator: Boolean(participant.is_facilitator),
    connected,
  };
}

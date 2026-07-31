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

/**
 * Shapes a vote for its OWN author only. There is deliberately no serializer
 * that shapes someone else's vote for pre-reveal transport — the hidden-until-
 * reveal guarantee (docs/stories/STORY-006) is kept by there being no code path
 * that sends another participant's value before the round is revealed.
 */
export function serializeOwnVote(vote) {
  if (!vote) return null;
  return {
    value: vote.value,
    pert:
      vote.pert_optimistic == null
        ? null
        : {
            optimistic: vote.pert_optimistic,
            likely: vote.pert_likely,
            pessimistic: vote.pert_pessimistic,
          },
    reason: vote.reason,
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

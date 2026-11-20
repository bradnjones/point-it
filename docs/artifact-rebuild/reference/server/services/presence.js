/**
 * In-memory tracker of which participants currently have a live socket. A
 * participant may have several sockets open (multiple tabs), so connections are
 * counted; a participant is "connected" while at least one socket is open.
 *
 * This is intentionally not persisted — presence is only meaningful for the
 * lifetime of a process, and the DB remains the record of who belongs to a
 * session.
 */
export function createPresence() {
  // participantId -> Set<socketId>
  const byParticipant = new Map();
  // socketId -> { sessionId, participantId }
  const bySocket = new Map();

  return {
    add(socketId, sessionId, participantId) {
      bySocket.set(socketId, { sessionId, participantId });
      if (!byParticipant.has(participantId)) byParticipant.set(participantId, new Set());
      byParticipant.get(participantId).add(socketId);
    },

    /** Removes a socket; returns its {sessionId, participantId} or null. */
    remove(socketId) {
      const entry = bySocket.get(socketId);
      if (!entry) return null;
      bySocket.delete(socketId);

      const sockets = byParticipant.get(entry.participantId);
      if (sockets) {
        sockets.delete(socketId);
        if (sockets.size === 0) byParticipant.delete(entry.participantId);
      }
      return entry;
    },

    isConnected(participantId) {
      return byParticipant.has(participantId);
    },

    get(socketId) {
      return bySocket.get(socketId) ?? null;
    },
  };
}

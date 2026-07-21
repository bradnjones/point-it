/**
 * Real-time session events.
 *
 * Currently only connection lifecycle — session rooms, voting, presence and
 * reveal land in STORY-004 / 006 / 007 / 008.
 *
 * Note for later stories: vote values must never be broadcast before the
 * facilitator reveals. See the "why" note in docs/stories/STORY-006.
 */
export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] connected ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected ${socket.id} (${reason})`);
    });
  });

  return io;
}

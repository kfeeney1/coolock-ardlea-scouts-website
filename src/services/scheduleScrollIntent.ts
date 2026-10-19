/** A command owns centring until a fresh pointer/touch/wheel gesture begins.
 * Tokens also reject callbacks queued by a gesture that a later command replaced.
 */
export function createScheduleScrollIntent() {
  let gesture = false;
  let generation = 0;
  return {
    beginGesture() { gesture = true; generation += 1; },
    command() { gesture = false; generation += 1; },
    ticket() { return gesture ? generation : null; },
    accepts(ticket: number | null) { return gesture && ticket !== null && ticket === generation; }
  };
}

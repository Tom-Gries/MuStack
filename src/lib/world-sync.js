// A delayed request must not undo a newer revision of the same personal world.
export function newestWorld(current, incoming) {
  if (!incoming) return current;
  if (current && current.id === incoming.id && incoming.revision < current.revision) return current;
  return incoming;
}

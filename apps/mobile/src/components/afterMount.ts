/** Runs `then` two frames on, once a commit made now has been mounted; returns what cancels it. */
export function afterMount(then: () => void): () => void {
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(then);
  });

  return () => cancelAnimationFrame(frame);
}

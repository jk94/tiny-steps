/** Minimal, shared error state — no UI kit in this project yet. */
export function ErrorMessage({ message }: { message: string }) {
  return <p role="alert">{message}</p>;
}

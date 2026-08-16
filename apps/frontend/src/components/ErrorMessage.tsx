/** Shared error state, styled with the design-system's semantic color vocabulary. */
export function ErrorMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

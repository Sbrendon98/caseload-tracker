// Shown when the on-device database cannot be opened at all.
export function FatalScreen({ error, isStorageError }) {
  const message = isStorageError ? error.message : 'Something went wrong while starting the app.';
  return (
    <main class="page">
      <h1>Cannot open your data</h1>
      <p class="form-error" role="alert">{message}</p>
      <p>
        Nothing has been changed or deleted. Close the app and open it again. If this keeps happening, check that you
        are not in Private Browsing and that your phone has free storage.
      </p>
      <button type="button" class="btn primary" onClick={() => window.location.reload()}>Try again</button>
    </main>
  );
}

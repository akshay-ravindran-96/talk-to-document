// Owns one recovery deadline. The session.update probe does not create a model response.
export function createVoiceRecovery(options: {
  probe: () => boolean;
  recovering: () => void;
  restored: () => void;
  lost: () => void;
  schedule?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
}) {
  const schedule = options.schedule ?? setTimeout;
  const cancel = options.cancel ?? clearTimeout;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let waiting = false;
  let disposed = false;
  function deadline(ms: number) {
    if (timer !== undefined) cancel(timer);
    timer = schedule(() => {
      timer = undefined;
      if (!waiting || disposed) return;
      waiting = false;
      options.lost();
    }, ms);
  }
  return {
    interrupt() {
      if (disposed || waiting) return;
      waiting = true;
      options.recovering();
      deadline(10_000);
    },
    online() {
      if (disposed || !waiting) return;
      // Allow a full probe deadline after online; it may arrive just before expiry.
      deadline(5_000);
      options.probe();
    },
    received() {
      if (disposed || !waiting) return;
      waiting = false;
      if (timer !== undefined) cancel(timer);
      timer = undefined;
      options.restored();
    },
    dispose() {
      disposed = true;
      waiting = false;
      if (timer !== undefined) cancel(timer);
      timer = undefined;
    },
  };
}

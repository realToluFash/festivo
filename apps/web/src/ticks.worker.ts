const scope = globalThis as unknown as Pick<Worker, 'onmessage' | 'postMessage'>;

scope.onmessage = (event: MessageEvent<number>) => {
  setInterval(() => scope.postMessage(0), event.data);
};

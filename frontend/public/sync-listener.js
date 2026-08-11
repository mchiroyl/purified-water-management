self.addEventListener('sync', (event) => {
  if (event.tag !== 'agua-pura-outbox') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => clients.forEach((client) => client.postMessage({ type: 'AGUA_PURA_SYNC_REQUESTED' }))),
  );
});

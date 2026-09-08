// Drop legacy query caches when an updated service worker activates.
// Current network rules never cache arbitrary cross-origin or API responses.
const cacheMigrationWorker = self as unknown as { addEventListener(type: "activate", listener: (event: { waitUntil(task: Promise<unknown>): void }) => void): void }
cacheMigrationWorker.addEventListener("activate", event => {
  event.waitUntil(Promise.all(["cross-origin", "apis"].map(name => caches.delete(name))))
})
export {}

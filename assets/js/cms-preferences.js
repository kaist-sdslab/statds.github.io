(() => {
  // Apply the newly requested default once, including browsers which remember
  // an earlier sort. Later choices in Sort by remain the editor's preference.
  const marker = 'sds.cms.people.group-desc.v1';
  try {
    if (!window.localStorage.getItem(marker)) {
      const key = 'decap-cms.entries.sort';
      const saved = JSON.parse(window.localStorage.getItem(key) || '{}');
      saved.people = { group: { key: 'group', direction: 'Descending', index: 0 } };
      window.localStorage.setItem(key, JSON.stringify(saved));
      window.localStorage.setItem(marker, '1');
    }
  } catch { /* Decap's configured default still applies without local storage. */ }
  try {
    const marker = 'sds.cms.resources.display-order.v1';
    if (!window.localStorage.getItem(marker)) {
      const key = 'decap-cms.entries.sort';
      const saved = JSON.parse(window.localStorage.getItem(key) || '{}');
      for (const collection of ['software', 'courses']) {
        saved[collection] = { order: { key: 'order', direction: 'Ascending', index: 0 } };
      }
      window.localStorage.setItem(key, JSON.stringify(saved));
      window.localStorage.setItem(marker, '1');
    }
  } catch { /* Use the configured default when local storage is unavailable. */ }
})();

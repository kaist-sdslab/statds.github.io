(() => {
  // Apply requested defaults once, including browsers with a remembered sort.
  // Subsequent choices in Sort by remain the editor's preference.
  const migrations = [
    ['sds.cms.people.group-desc.v1', { people: { group: { key: 'group', direction: 'Descending', index: 0 } } }],
    ['sds.cms.resources.display-order.v1', {
      software: { order: { key: 'order', direction: 'Ascending', index: 0 } },
      courses: { order: { key: 'order', direction: 'Ascending', index: 0 } }
    }],
    ['sds.cms.papers.year-desc.v1', { papers: { year: { key: 'year', direction: 'Descending', index: 0 } } }]
  ];
  for (const [marker, defaults] of migrations) {
    try {
      const storage = window.localStorage;
      if (storage.getItem(marker)) continue;
      const key = 'decap-cms.entries.sort';
      let saved;
      try { saved = JSON.parse(storage.getItem(key) || '{}'); } catch { saved = {}; }
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
      storage.setItem(key, JSON.stringify({ ...saved, ...defaults }));
      storage.setItem(marker, '1');
    } catch { /* Decap's configured defaults apply when storage is unavailable. */ }
  }
})();

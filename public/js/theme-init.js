// Runs before first paint (loaded synchronously from <head>) so the saved theme never flashes.
try {
  const saved = localStorage.getItem('mth-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch { /* storage blocked: follow the system theme */ }

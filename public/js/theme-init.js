// Runs before first paint (loaded synchronously from <head>) so the theme never flashes.
// Dark is the default; a saved choice wins, otherwise a light system preference is respected.
(() => {
  let theme = 'dark';
  try {
    const saved = localStorage.getItem('mth-theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
    else if (matchMedia('(prefers-color-scheme: light)').matches) theme = 'light';
  } catch { /* storage blocked: keep the default */ }
  document.documentElement.dataset.theme = theme;
})();

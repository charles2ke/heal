// Loaded as a classic script in <head> so a saved theme applies before the
// first paint, without a flash of the other theme.
(function () {
  try {
    var theme = localStorage.getItem('heal:theme');
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (error) {
    // Storage is unavailable: follow the system theme.
  }
})();

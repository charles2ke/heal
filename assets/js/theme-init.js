// Loaded as a classic script in <head> so a saved theme applies before the
// first paint, without a flash of the other theme.
(function () {
  try {
    var theme = localStorage.getItem('heal:theme');
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
      // Matches the browser's toolbar to the chosen theme (see theme.js).
      var colours = document.querySelectorAll('meta[name="theme-color"][data-scheme]');
      for (var i = 0; i < colours.length; i++) {
        colours[i].setAttribute('media', colours[i].getAttribute('data-scheme') === theme ? 'all' : 'not all');
      }
    }
  } catch (error) {
    // Storage is unavailable: follow the system theme.
  }
})();

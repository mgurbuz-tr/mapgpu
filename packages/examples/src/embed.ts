// Auto-detect embed mode (iframe or ?embed=1 query param)
if (window !== window.top || new URLSearchParams(location.search).has('embed')) {
  document.body.classList.add('embed-mode');
}

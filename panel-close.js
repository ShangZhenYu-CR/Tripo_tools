document.getElementById('close-panel')?.addEventListener('click', () => {
  window.parent.postMessage({
    source: 'tripo-multiview-paste',
    type: 'TMP_CLOSE_PANEL'
  }, '*');
});

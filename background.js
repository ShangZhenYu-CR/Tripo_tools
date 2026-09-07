const ext = globalThis.browser ?? globalThis.chrome;

const TRIPO_PATTERNS = ['*://tripo3d.ai/*', '*://*.tripo3d.ai/*'];

ext.action.onClicked.addListener(async (clickedTab) => {
  try {
    let target = clickedTab;

    if (!target?.id || !isTripoUrl(target.url)) {
      const tabs = await ext.tabs.query({ url: TRIPO_PATTERNS });
      target = tabs.find((tab) => tab.active) || tabs[tabs.length - 1] || null;
      if (target?.id) {
        await ext.tabs.update(target.id, { active: true });
        if (target.windowId != null) {
          await ext.windows.update(target.windowId, { focused: true });
        }
      }
    }

    if (!target?.id) return;

    await ext.tabs.sendMessage(target.id, { type: 'TMP_TOGGLE_PANEL' });
  } catch (error) {
    // The most common case is that the Tripo tab was open before the extension was
    // installed/reloaded. Refreshing that tab once installs the content script.
    console.warn('Tripo Multiview Paste: could not toggle panel', error);
  }
});

function isTripoUrl(url) {
  try {
    const host = new URL(String(url || '')).hostname.toLowerCase();
    return host === 'tripo3d.ai' || host.endsWith('.tripo3d.ai');
  } catch (_) {
    return false;
  }
}

/**
 * @fileoverview Injects the Chorduction button into Spotify player controls.
 * Uses MutationObserver + multiple selector fallbacks for robustness across Spotify versions.
 * @module platforms/spicetify/button-injector
 */

const PLAYER_SELECTORS = [
  '[data-testid="player-controls"]',
  '.player-controls__right',
  '.player-controls__buttons',
  '.player-controls',
  '.main-nowPlayingBar-nowPlayingBar',
  '[class*="player-controls"]',
];

/**
 * @param {Function} onClick
 * @param {import('../../utils/cleanup-manager.js').CleanupManager} cleanup
 * @param {import('../../utils/logger.js').Logger} logger
 */
export function injectButton(onClick, cleanup, logger) {
  const tryInject = () => {
    if (document.getElementById('chorduction-btn')) { return true; }
    for (const sel of PLAYER_SELECTORS) {
      const container = document.querySelector(sel);
      if (container) {
        const btn = _createButton(onClick);
        container.appendChild(btn);
        cleanup.addElement(btn);
        logger.info(`[ButtonInjector] Injected via selector: ${sel}`);
        return true;
      }
    }
    return false;
  };

  // Try immediately, then retry with backoff
  if (!tryInject()) {
    const delays = [500, 1000, 2000, 3000, 5000];
    for (const ms of delays) {
      cleanup.addTimer(setTimeout(() => {
        if (!document.getElementById('chorduction-btn')) { tryInject(); }
      }, ms));
    }
  }

  // MutationObserver for Spotify SPA navigation
  const observer = new MutationObserver(() => {
    if (!document.getElementById('chorduction-btn')) { tryInject(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  cleanup.addListener({ addEventListener: (_e, _h) => {}, removeEventListener: () => observer.disconnect() }, 'disconnect', () => {});
}

/** @param {Function} onClick @returns {HTMLButtonElement} */
function _createButton(onClick) {
  const btn = document.createElement('button');
  btn.id        = 'chorduction-btn';
  btn.title     = 'Open Chorduction (Alt+T)';
  btn.innerHTML = '<span style="font-size:20px;line-height:1" aria-label="Chorduction">🎸</span>';
  btn.style.cssText = [
    'background:transparent', 'border:none', 'color:#b3b3b3',
    'cursor:pointer', 'padding:8px', 'border-radius:50%',
    'display:flex', 'align-items:center', 'justify-content:center',
    'transition:color 0.2s',
  ].join(';');
  btn.onmouseover = () => { btn.style.color = '#fff'; };
  btn.onmouseout  = () => { btn.style.color = '#b3b3b3'; };
  btn.addEventListener('click', onClick);
  return btn;
}

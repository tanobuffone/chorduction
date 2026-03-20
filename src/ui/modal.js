/**
 * @fileoverview Modal shell — Spicetify.PopupModal wrapper with custom fallback.
 * @module ui/modal
 */

import { t } from '../utils/i18n.js';

/**
 * Display the Chorduction panel.
 * Tries Spicetify.PopupModal first; falls back to a custom overlay modal.
 * @param {HTMLElement} content
 * @param {string} [lang]
 */
export function showModal(content, lang = 'en') {
  const title = `🎸 ${t('title', lang)}`;

  if (Spicetify?.PopupModal?.display) {
    Spicetify.PopupModal.display({ title, content, isLarge: true });
    return;
  }

  // Custom fallback modal
  _removeExisting();
  const backdrop = document.createElement('div');
  backdrop.id = 'chorduction-modal';
  Object.assign(backdrop.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(0,0,0,0.8)',
    zIndex: '99999',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    background: '#282828', borderRadius: '8px',
    maxWidth: '800px', width: '90vw', maxHeight: '85vh',
    overflow: 'auto', padding: '20px', color: '#fff',
    position: 'relative',
  });

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.setAttribute('aria-label', 'Close');
  Object.assign(closeBtn.style, {
    position: 'absolute', top: '12px', right: '12px',
    background: 'none', border: 'none', color: '#888',
    fontSize: '18px', cursor: 'pointer',
  });
  closeBtn.onclick = _removeExisting;

  panel.appendChild(closeBtn);
  panel.appendChild(content);
  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);

  backdrop.addEventListener('click', e => { if (e.target === backdrop) { _removeExisting(); } });
  backdrop.addEventListener('keydown', e => { if (e.key === 'Escape') { _removeExisting(); } });

  // Focus first interactive element
  setTimeout(() => {
    const first = /** @type {HTMLElement|null} */ (panel.querySelector('button, select, input'));
    first?.focus();
  }, 50);
}

export function hideModal() {
  if (Spicetify?.PopupModal?.hide) { Spicetify.PopupModal.hide(); }
  _removeExisting();
}

function _removeExisting() {
  document.getElementById('chorduction-modal')?.remove();
}

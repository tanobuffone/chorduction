/**
 * @fileoverview Background service worker — manages extension state and inter-tab messaging.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Chorduction-YT] Extension installed');
});

// Relay messages between content script and popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_ANALYSIS') {
    chrome.storage.local.get(['chorduction_yt_analysis'], result => {
      sendResponse(result.chorduction_yt_analysis ?? null);
    });
    return true; // async
  }
  if (msg.type === 'SET_ANALYSIS') {
    chrome.storage.local.set({ chorduction_yt_analysis: msg.payload });
  }
});

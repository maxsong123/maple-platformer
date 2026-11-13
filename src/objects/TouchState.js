/** Shared, scene-independent touch button state (written by TouchScene, read by Controls). */
export const touch = {
  enabled: false,
  left: false, right: false, jump: false, attack: false,
  jumpTap: false, attackTap: false,   // latched on pointerdown so very quick taps never get lost
};

export function isTouchDevice() {
  const q = new URLSearchParams(location.search);
  if (q.has('touch')) return true;
  if (q.has('notouch')) return false;
  return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}

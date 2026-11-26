import { useEffect } from 'react';

const covenControl = [
  '.coven-community :is(button, [role="button"], .coven-nav-link)',
  '.coven-entry :is(a, button)',
  '[data-coven-controls] button',
  '.coven-action',
  '.coven-press',
].join(', ');

export function useCovenPressGlow() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const activeGlows = new WeakMap<HTMLElement, Animation>();

    function glowOnClick(event: MouseEvent) {
      if (reducedMotion.matches || !(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>(covenControl);
      if (!control || control.matches(':disabled, [aria-disabled="true"]') || !control.animate) return;

      activeGlows.get(control)?.cancel();
      const baseFilter = getComputedStyle(control).filter;
      const gold = getComputedStyle(control).getPropertyValue('--hero-gold').trim();
      const filter = `${baseFilter === 'none' ? '' : baseFilter + ' '}drop-shadow(0 0 7px hsl(${gold} / 0.56)) drop-shadow(0 0 14px hsl(${gold} / 0.32))`;
      activeGlows.set(control, control.animate(
        [{ filter }, { filter: baseFilter }],
        { duration: 440, easing: 'ease-out' },
      ));
    }

    document.addEventListener('click', glowOnClick, { capture: true });
    return () => document.removeEventListener('click', glowOnClick, { capture: true });
  }, []);
}

// Shared by the server layout (inline script) and the client theme hook

export const THEME_STORAGE_KEY = 'spendly-theme';
export const LIGHT_QUERY = '(prefers-color-scheme: light)';

/**
 * Inline <head> script: sets data-theme before first paint, so a light-mode user never sees a dark flash.
 * Same rules as readPref/resolve in theme.ts.
 */
export const THEME_INIT_SCRIPT = `(function(){var t='dark';try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');if(p==='light')t='light';else if(p==='system'&&matchMedia('${LIGHT_QUERY}').matches)t='light';}catch(e){}document.documentElement.dataset.theme=t;})();`;

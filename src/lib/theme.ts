'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY as STORAGE_KEY, LIGHT_QUERY } from './themeScript';

/** What the user picked; 'system' follows the OS setting */
export type ThemePref = 'dark' | 'light' | 'system';
export type Theme = 'dark' | 'light';

// Saved per device (browser storage), so it also applies on the logged-out auth pages
const CHANGE_EVENT = 'spendly-theme-change';

function readPref(): ThemePref {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v === 'light' || v === 'system' ? v : 'dark';
    } catch {
        return 'dark';
    }
}

function resolve(pref: ThemePref): Theme {
    if (pref !== 'system') return pref;
    return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
}

function apply(pref: ThemePref) {
    document.documentElement.dataset.theme = resolve(pref);
}

function subscribe(onChange: () => void) {
    const media = window.matchMedia(LIGHT_QUERY);
    const onMedia = () => {
        if (readPref() === 'system') apply('system');
        onChange();
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onMedia); // another tab changed it
    media.addEventListener('change', onMedia);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener('storage', onMedia);
        media.removeEventListener('change', onMedia);
    };
}

// Snapshot is a primitive string so useSyncExternalStore can compare it cheaply
const getSnapshot = () => `${readPref()}:${resolve(readPref())}`;
const getServerSnapshot = () => 'dark:dark';

export function useTheme() {
    const [pref, theme] = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).split(':') as [ThemePref, Theme];

    const setPref = useCallback((next: ThemePref) => {
        try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage blocked: applies for this page only */ }
        apply(next);
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    /** Flip to the opposite of what is showing now (leaves 'system') */
    const toggle = useCallback(() => setPref(theme === 'light' ? 'dark' : 'light'), [setPref, theme]);

    return { pref, theme, setPref, toggle };
}

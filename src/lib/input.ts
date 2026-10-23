// Small helpers for form inputs and keyboard shortcuts.

/** Largest amount anywhere in the app (expenses, budget rows, limits); the API refuses more */
export const MAX_AMOUNT = 10_000_000;

/**
 * What a money box keeps while typing: digits, one ".", at most 2 decimals and 8 whole digits.
 * "12.345" → "12.34", "1.2.3" → "1.23", "abc" → "".
 */
export function cleanMoney(raw: string): string {
    const s = raw.replace(/[^0-9.]/g, '');
    const dot = s.indexOf('.');
    if (dot < 0) return s.slice(0, 8);
    return `${s.slice(0, dot).slice(0, 8)}.${s.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`;
}

const NOT_TYPING = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file']);

/** True while the user is typing text, so single-key shortcuts (N, 1–5, /) should stay out of the way */
export function isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el?.tagName) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'select') return true;
    return tag === 'input' && !NOT_TYPING.has((el as HTMLInputElement).type);
}

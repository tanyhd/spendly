import { cleanMoney, isTyping } from './input';

describe('cleanMoney', () => {
    it.each([
        ['12.345', '12.34'], ['1.2.3', '1.23'], ['abc', ''], ['$1,234.5', '1234.5'],
        ['.5', '.5'], ['12.', '12.'], ['123456789', '12345678'], ['-3', '3'],
    ])('%s → %s', (raw, out) => {
        expect(cleanMoney(raw)).toBe(out);
    });
});

describe('isTyping', () => {
    // isTyping only reads tagName, type and isContentEditable
    const el = (tagName: string, type = 'text') => ({ tagName, type, isContentEditable: false }) as unknown as EventTarget;

    it('text boxes, textareas and selects count as typing', () => {
        expect(isTyping(el('INPUT'))).toBe(true);
        expect(isTyping(el('INPUT', 'date'))).toBe(true);
        expect(isTyping(el('TEXTAREA'))).toBe(true);
        expect(isTyping(el('SELECT'))).toBe(true);
    });

    it('a ticked checkbox or a button does not, so shortcuts keep working', () => {
        expect(isTyping(el('INPUT', 'checkbox'))).toBe(false);
        expect(isTyping(el('BUTTON'))).toBe(false);
        expect(isTyping(null)).toBe(false);
    });
});

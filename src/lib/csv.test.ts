import { csvCell, toCsv } from './csv';

describe('csv', () => {
    it('quotes text and doubles quotes inside it', () => {
        expect(csvCell('lunch, with "Sam"')).toBe('"lunch, with ""Sam"""');
    });

    it('keeps newlines inside the quoted cell', () => {
        expect(toCsv([['a\nb', 1]])).toBe('"a\nb",1\r\n');
    });

    it('stops spreadsheets running text as a formula', () => {
        expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
        expect(csvCell('+1')).toBe('"\'+1"');
        expect(csvCell('-cmd')).toBe('"\'-cmd"');
        expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    });

    it('writes numbers as they are, negatives included', () => {
        expect(csvCell(-12.5)).toBe('-12.5');
        expect(csvCell(0)).toBe('0');
    });
});

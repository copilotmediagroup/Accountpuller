import { describe, expect, it } from 'vitest';
import { parseCsv, compareAccounts, toCsv } from './engine.js';
describe('account integrity', () => {
  it('preserves long IDs and leading zeros', () => {
    const csv='Account,Name\n000123456789012345678901,Alice\n999999999999999999999999,Bob';
    const parsed=parseCsv(csv);
    expect(parsed.rows[0].Account).toBe('000123456789012345678901');
    expect(parsed.rows[1].Account).toBe('999999999999999999999999');
  });
  it('matches exact account strings and keeps full master rows', () => {
    const master=parseCsv('Acct,Name,Balance\n00123,Alice,50\n123,Bob,75\n999,Chris,25');
    const buyer=parseCsv('Account Number\n123');
    const out=compareAccounts(master.rows,buyer.rows,'Acct','Account Number');
    expect(out.matches.map(r=>r.Acct)).toEqual(['123']);
    expect(out.available.map(r=>r.Acct)).toEqual(['00123','999']);
    expect(out.available[0].Name).toBe('Alice');
  });
  it('round trips account strings without scientific notation', () => {
    const p=parseCsv('Acct,Name\n000123456789012345678901,Alice');
    const csv=toCsv(p.rows,p.fields);
    expect(csv).toContain('000123456789012345678901');
    expect(csv).not.toMatch(/e\+\d+/i);
  });
});

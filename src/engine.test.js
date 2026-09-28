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

describe('portfolio quality controls', () => {
  it('reports duplicates and blank account numbers', async () => {
    const { accountStats } = await import('./engine.js');
    const rows = [{id:'001'},{id:'001'},{id:'002'},{id:''},{id:'  '}];
    expect(accountStats(rows,'id')).toEqual({ unique:2, blank:2, duplicateIds:1, duplicateRows:1 });
  });
  it('does not fuzzy-match account numbers', () => {
    const master=parseCsv('Acct,Name\n00123,A\n123,B\nABC-9,C');
    const buyer=parseCsv('Acct\n00123\nabc-9');
    const out=compareAccounts(master.rows,buyer.rows,'Acct','Acct');
    expect(out.matches.map(r=>r.Acct)).toEqual(['00123']);
    expect(out.available.map(r=>r.Acct)).toEqual(['123','ABC-9']);
  });
});

describe('verbatim CSV identifiers', () => {
  it('exports the exact account text stored in master', () => {
    const original = '000123456789012345678901234567890';
    const parsed = parseCsv('Account,Name\n' + original + ',Alice');
    const exported = toCsv(parsed.rows, parsed.fields);
    const reparsed = parseCsv(exported);
    expect(reparsed.rows[0].Account).toBe(original);
  });
  it('preserves 30 digit identifiers exactly', () => {
    const original = '987654321012345678909876543210';
    const parsed = parseCsv('Account\n' + original);
    expect(parsed.rows[0].Account).toBe(original);
    expect(toCsv(parsed.rows, parsed.fields)).toContain(original);
  });
});

describe('unsafe identifier detection contract', () => {
  it('keeps scientific notation literal instead of inventing digits', () => {
    const parsed = parseCsv('Account,Name\n2.461E+12,Jack');
    expect(parsed.rows[0].Account).toBe('2.461E+12');
    expect(toCsv(parsed.rows, parsed.fields)).toContain('2.461E+12');
  });
});

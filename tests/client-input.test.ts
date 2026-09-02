import { describe, expect, it } from 'vitest';
import { EXAMPLE_CLIENT_JSON, parseClientInput } from '@/lib/client-input';
import { evaluateClient } from '@/lib/rules';
import { SUPPORTED_TAX_YEARS } from '@/lib/tax-year';

function parsed(json: string) {
  const result = parseClientInput(json);
  if (!result.ok) throw new Error(`expected success, got: ${result.errors.join(' | ')}`);
  return result;
}

function errors(json: string): string[] {
  const result = parseClientInput(json);
  if (result.ok) throw new Error('expected failure, got a client');
  return result.errors;
}

describe('the bundled example', () => {
  it('parses and evaluates', () => {
    const { client } = parsed(EXAMPLE_CLIENT_JSON);
    const evaluation = evaluateClient(client);

    expect(client.displayName).toBe('Alex Rivera');
    expect(evaluation.findings.length).toBeGreaterThan(0);
    expect(evaluation.federal.totalFederalTax).toBeGreaterThan(0);
  });

  it('produces no warnings, so it is a clean template to copy', () => {
    expect(parsed(EXAMPLE_CLIENT_JSON).warnings).toEqual([]);
  });
});

describe('forgiving input', () => {
  it('accepts a minimal record and fills the rest with zeros', () => {
    const { client } = parsed('{"displayName":"Min","income":{"wages":900000}}');

    expect(client.income.wages).toBe(900_000);
    expect(client.income.bonus).toBe(0);
    expect(client.gifts).toEqual([]);
    expect(client.trusts).toEqual([]);
    expect(client.foreignAccounts).toEqual([]);
  });

  it('reads amounts written with dollar signs and commas', () => {
    const { client } = parsed('{"income":{"wages":"$1,200,000","bonus":"250,000"}}');

    expect(client.income.wages).toBe(1_200_000);
    expect(client.income.bonus).toBe(250_000);
  });

  it('defaults a gift to a present interest unless it goes into a trust', () => {
    const { client } = parsed(
      '{"gifts":[{"recipient":"A","amount":1},{"recipient":"B","amount":1,"intoTrust":true}]}',
    );

    expect(client.gifts[0]?.presentInterest).toBe(true);
    expect(client.gifts[1]?.presentInterest).toBe(false);
  });

  it('defaults a foreign account year-end value to its maximum', () => {
    const { client } = parsed(
      '{"foreignAccounts":[{"institution":"X","country":"Y","maximumValueUSD":50000}]}',
    );
    expect(client.foreignAccounts[0]?.yearEndValueUSD).toBe(50_000);
  });

  it('warns rather than fails when the filing status is missing', () => {
    const { client, warnings } = parsed('{"displayName":"X"}');

    expect(client.filingStatus).toBe('marriedFilingJointly');
    expect(warnings.join(' ')).toMatch(/filingStatus/);
  });

  it('warns about a field name the model does not use', () => {
    const { warnings } = parsed('{"income":{"wagez":500000}}');
    expect(warnings.join(' ')).toMatch(/wagez/);
  });
});

describe('rejected input', () => {
  it('rejects empty input', () => {
    expect(errors('   ').join(' ')).toMatch(/paste a client record/i);
  });

  it('explains malformed JSON in terms a non-programmer can act on', () => {
    const messages = errors('{"displayName":"X",}').join(' ');
    expect(messages).toMatch(/not valid JSON/);
    expect(messages).toMatch(/trailing comma/);
  });

  it('rejects a non-object at the top level', () => {
    expect(errors('[1, 2, 3]').join(' ')).toMatch(/single object/);
  });

  it('lists the valid filing statuses when given a bad one', () => {
    const message = errors('{"filingStatus":"marriedish"}').join(' ');
    expect(message).toMatch(/filingStatus/);
    expect(message).toMatch(/marriedFilingJointly/);
  });

  it('rejects a tax year the project does not model', () => {
    const message = errors('{"taxYear":2031}').join(' ');
    expect(message).toMatch(/taxYear/);
    expect(message).toMatch(String(SUPPORTED_TAX_YEARS[0]));
  });

  it('names the offending index when a gift has no recipient', () => {
    expect(errors('{"gifts":[{"amount":1},{"recipient":"B","amount":2}]}').join(' ')).toMatch(
      /gifts\[0\]/,
    );
  });

  it('rejects an amount that is not a number', () => {
    expect(errors('{"income":{"wages":"quite a lot"}}').join(' ')).toMatch(/income\.wages/);
  });

  it('rejects a list written as an object', () => {
    expect(errors('{"gifts":{"recipient":"A"}}').join(' ')).toMatch(/square brackets/);
  });
});

describe('a loaded record behaves like a built-in one', () => {
  it('runs every module and trips the aggregate FBAR rule', () => {
    const { client } = parsed(`{
      "displayName": "Aggregate Test",
      "income": { "wages": 400000 },
      "foreignAccounts": [
        { "institution": "A", "country": "France", "maximumValueUSD": 4000 },
        { "institution": "B", "country": "France", "maximumValueUSD": 3500 },
        { "institution": "C", "country": "Japan",  "maximumValueUSD": 3000 }
      ]
    }`);
    const evaluation = evaluateClient(client);

    // No single account is near the threshold; the aggregate is what trips it.
    expect(evaluation.foreign.aggregateMaximumValue).toBe(10_500);
    expect(evaluation.foreign.fbarReviewFlag).toBe(true);
    expect(evaluation.findings.map((f) => f.ruleId)).toContain('FBAR-AGGREGATE');
  });

  it('carries no identifying fields through, whatever was pasted', () => {
    const { client } = parsed(
      '{"displayName":"X","ssn":"123-45-6789","dateOfBirth":"1970-01-01","address":"1 Main St"}',
    );
    const serialized = JSON.stringify(client);

    expect(serialized).not.toMatch(/123-45-6789/);
    expect(serialized).not.toMatch(/1 Main St/);
    expect(Object.keys(client)).not.toContain('ssn');
  });
});

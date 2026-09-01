import { describe, expect, it } from 'vitest';
import { SAMPLE_CLIENTS } from '@/data/clients';
import { AUTHORITIES, getAuthority } from '@/lib/research/authorities';
import { RULES, evaluateClient } from '@/lib/rules';
import { SUPPORTED_TAX_YEARS, getTaxYear } from '@/lib/tax-year';

const AUTHORITY_IDS = new Set(AUTHORITIES.map((authority) => authority.id));
const GOVERNMENT_HOSTS = ['irs.gov', 'uscode.house.gov', 'ecfr.gov', 'govinfo.gov', 'fincen.treas.gov'];

describe('research library', () => {
  it('has unique identifiers', () => {
    expect(AUTHORITY_IDS.size).toBe(AUTHORITIES.length);
  });

  it('cites only government sources over https', () => {
    for (const authority of AUTHORITIES) {
      const url = new URL(authority.sourceUrl);
      expect(url.protocol, authority.id).toBe('https:');
      expect(
        GOVERNMENT_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)),
        `${authority.id} cites ${url.hostname}`,
      ).toBe(true);
    }
  });

  it('records a verification date in ISO form for every entry', () => {
    for (const authority of AUTHORITIES) {
      expect(authority.lastVerified, authority.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(authority.lastVerified))).toBe(false);
    }
  });

  it('states a rule description and citation for every entry', () => {
    for (const authority of AUTHORITIES) {
      expect(authority.ruleDescription.length, authority.id).toBeGreaterThan(40);
      expect(authority.citation.length, authority.id).toBeGreaterThan(3);
      expect(authority.governmentSource.length, authority.id).toBeGreaterThan(3);
    }
  });

  it('resolves each entry by id', () => {
    for (const authority of AUTHORITIES) {
      expect(getAuthority(authority.id)).toBe(authority);
    }
  });

  it('throws on an unknown id rather than returning a placeholder', () => {
    expect(() => getAuthority('does-not-exist')).toThrow(/Unknown authority/);
  });
});

describe('rule set', () => {
  it('has unique rule identifiers', () => {
    const ids = RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('states a deterministic test and cites at least one authority per rule', () => {
    for (const rule of RULES) {
      expect(rule.test.length, rule.id).toBeGreaterThan(10);
      expect(rule.description.length, rule.id).toBeGreaterThan(20);
      expect(rule.authorityIds.length, rule.id).toBeGreaterThan(0);
    }
  });

  it('references only authorities that exist in the library', () => {
    for (const rule of RULES) {
      for (const id of rule.authorityIds) {
        expect(AUTHORITY_IDS.has(id), `${rule.id} -> ${id}`).toBe(true);
      }
    }
  });
});

describe('findings', () => {
  const evaluations = SAMPLE_CLIENTS.map((client) => evaluateClient(client));

  it('carries the full chain on every finding', () => {
    for (const evaluation of evaluations) {
      for (const finding of evaluation.findings) {
        expect(finding.clientFact.length, finding.id).toBeGreaterThan(10);
        expect(finding.analysis.length, finding.id).toBeGreaterThan(40);
        expect(finding.potentialForms.length, finding.id).toBeGreaterThan(0);
        expect(finding.authorityIds.length, finding.id).toBeGreaterThan(0);
        for (const id of finding.authorityIds) {
          expect(AUTHORITY_IDS.has(id), `${finding.id} -> ${id}`).toBe(true);
        }
      }
    }
  });

  it('produces unique finding identifiers within a client', () => {
    for (const evaluation of evaluations) {
      const ids = evaluation.findings.map((finding) => finding.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('orders review items ahead of monitor and informational items', () => {
    for (const evaluation of evaluations) {
      const severities = evaluation.findings.map((finding) => finding.severity);
      const rank = { review: 0, monitor: 1, informational: 2 } as const;
      const ranks = severities.map((severity) => rank[severity]);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it('is deterministic across repeated evaluation', () => {
    for (const client of SAMPLE_CLIENTS) {
      const first = evaluateClient(client).findings.map((finding) => finding.id);
      const second = evaluateClient(client).findings.map((finding) => finding.id);
      expect(second).toEqual(first);
    }
  });
});

describe('tax year constants', () => {
  it('exposes the supported years through the registry', () => {
    expect(SUPPORTED_TAX_YEARS).toContain(2025);
  });

  it('rejects an unmodeled year rather than falling back silently', () => {
    expect(() => getTaxYear(1999)).toThrow(/No modeled constants/);
  });

  it('resolves each source key against the research library', () => {
    const constants = getTaxYear(2025);
    for (const [key, id] of Object.entries(constants.sourceKeys)) {
      expect(AUTHORITY_IDS.has(id), `sourceKeys.${key} -> ${id}`).toBe(true);
    }
  });

  it('orders every rate schedule by ascending bracket floor', () => {
    const constants = getTaxYear(2025);
    const schedules = [
      ...Object.values(constants.ordinaryRates),
      constants.fiduciary.rates,
    ];
    for (const brackets of schedules) {
      const floors = brackets.map((bracket) => bracket.floor);
      expect(floors).toEqual([...floors].sort((a, b) => a - b));
      expect(floors[0]).toBe(0);
    }
  });
});

describe('sample client data', () => {
  it('uses unique client identifiers', () => {
    const ids = SAMPLE_CLIENTS.map((client) => client.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers the three documented archetypes', () => {
    expect(SAMPLE_CLIENTS.map((client) => client.archetype).sort()).toEqual([
      'businessOwner',
      'corporateExecutive',
      'internationalExecutive',
    ]);
  });

  it('carries no field capable of holding identifying numbers', () => {
    const serialized = JSON.stringify(SAMPLE_CLIENTS);
    // Guards against a social security or similar identifier being introduced by hand.
    expect(serialized).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
    expect(Object.keys(SAMPLE_CLIENTS[0]!)).not.toContain('ssn');
    expect(Object.keys(SAMPLE_CLIENTS[0]!)).not.toContain('taxpayerIdentificationNumber');
  });
});

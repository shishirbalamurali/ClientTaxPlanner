import type { Client } from '@/lib/types';
import { Tag } from '@/components/ui/badge';
import { Metric, MetricRow, StatLine } from '@/components/ui/metric';
import { MetaItem, PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th, TotalRow } from '@/components/ui/table';
import { computeNetWorth } from '@/lib/analysis/executive-summary';
import { summarizeIncome } from '@/lib/analysis/federal-model';
import { compactUsd, pct, usd, usdAccounting } from '@/lib/format';
import {
  FILING_STATUS_LABELS,
  FOREIGN_ACCOUNT_TYPE_LABELS,
  FOREIGN_ENTITY_LABELS,
  GIFT_ASSET_LABELS,
  TRUST_KIND_LABELS,
} from '@/lib/labels';
import { getTaxYear } from '@/lib/tax-year';

const REAL_ESTATE_USE: Record<string, string> = {
  primaryResidence: 'Primary residence',
  secondResidence: 'Second residence',
  rental: 'Rental',
  landHeldForInvestment: 'Land held for investment',
};

export function ProfileView({ client }: { client: Client }) {
const constants = getTaxYear(client.taxYear);
  const income = summarizeIncome(client);
  const netWorth = computeNetWorth(client);
  const bs = client.balanceSheet;
  const concentrated = bs.concentratedPositions.reduce((sum, p) => sum + p.marketValue, 0);
  const realEstateValue = bs.realEstate.reduce((sum, r) => sum + r.marketValue, 0);
  const mortgages = bs.realEstate.reduce((sum, r) => sum + r.mortgageBalance, 0);
  const charitableTotal =
    client.deductions.charitableCash +
    client.deductions.charitableAppreciatedSecurities +
    client.deductions.charitablePrivateFoundation;

  const incomeLines: Array<[string, number, string]> = [
    ['Wages', client.income.wages, 'Form 1040, line 1a'],
    ['Bonus', client.income.bonus, 'Form 1040, line 1a'],
    ['Equity compensation', client.income.equityCompensation, 'Form 1040, line 1a'],
    ['Taxable interest', client.income.taxableInterest, 'Schedule B'],
    ['Tax-exempt interest', client.income.taxExemptInterest, 'Form 1040, line 2a'],
    ['Qualified dividends', client.income.qualifiedDividends, 'Form 1040, line 3a'],
    ['Non-qualified dividends', client.income.nonQualifiedDividends, 'Schedule B'],
    ['Short-term capital gain', client.income.shortTermCapitalGain, 'Schedule D'],
    ['Long-term capital gain', client.income.longTermCapitalGain, 'Schedule D'],
    ['Business income', client.income.businessIncome, 'Schedule E'],
    ['Rental income', client.income.rentalIncome, 'Schedule E'],
    ['Trust distributions', client.income.trustDistributions, 'Schedule E'],
    ['Retirement distributions', client.income.retirementDistributions, 'Form 1040, line 4b'],
    ['Other income', client.income.otherIncome, 'Schedule 1'],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Client profile"
        title={client.displayName}
        summary={`Every figure in the analysis modules is derived from this record. No identifying numbers are held: the file carries no taxpayer identification number, date of birth, address or account number. ${client.residency.residencyNote}`}
        meta={
          <>
            <MetaItem label="Engagement" value={client.engagementRef} />
            <MetaItem label="Tax year" value={client.taxYear} />
            <MetaItem label="Filing status" value={FILING_STATUS_LABELS[client.filingStatus]} />
            <MetaItem label="State" value={`${client.residency.stateName} (${client.residency.stateCode})`} />
          </>
        }
      />

      <MetricRow>
        <Metric label="Total modeled income" value={usd(income.totalModeledIncome)} />
        <Metric label="Modeled net worth" value={compactUsd(netWorth)} note="Includes revocable trust assets, net of liabilities" />
        <Metric label="Charitable contributions" value={usd(charitableTotal)} />
        <Metric
          label="Transfers made"
          value={usd(client.gifts.reduce((sum, gift) => sum + gift.amount, 0))}
          note={`${client.gifts.length} transfers`}
        />
      </MetricRow>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Household">
          <StatLine label="Age" value={String(client.age)} />
          <StatLine label="Occupation" value={client.occupation} />
          <StatLine label="Employer" value={client.employer} />
          <StatLine label="Filing status" value={FILING_STATUS_LABELS[client.filingStatus]} />
          {client.spouseName && (
            <>
              <StatLine label="Spouse" value={`${client.spouseName}, age ${client.spouseAge ?? '—'}`} />
              <StatLine
                label="Spouse citizenship"
                value={client.spouseIsUSCitizen ? 'U.S. citizen' : 'Non-U.S. citizen'}
              />
            </>
          )}
          <StatLine
            label="Residence"
            value={
              client.residency.livesAbroad
                ? `${client.residency.countryOfResidence ?? 'Abroad'} (${client.residency.stateCode} domicile under review)`
                : `${client.residency.stateName}`
            }
          />
          <StatLine
            label="Modeled top state rate"
            value={client.residency.topMarginalStateRate === 0 ? 'None modeled' : pct(client.residency.topMarginalStateRate)}
          />

          <div className="mt-4">
            <div className="eyebrow mb-1.5">Dependents</div>
            {client.dependents.length === 0 ? (
              <p className="text-[12.5px] text-ink-3">None recorded.</p>
            ) : (
              <ul className="space-y-1">
                {client.dependents.map((dependent) => (
                  <li key={dependent.name} className="flex justify-between text-[12.5px]">
                    <span>
                      {dependent.name}{' '}
                      <span className="text-ink-4">({dependent.relationship})</span>
                    </span>
                    <span className="tnum text-ink-3">
                      Age {dependent.age}
                      {dependent.inCollege ? ' · in college' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title={`Income detail — ${constants.year}`} bodyClassName="p-0">
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Source</Th>
                  <Th>Reported on</Th>
                  <Th numeric>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {incomeLines.map(([label, amount, line]) => (
                  <tr key={label} className={amount === 0 ? 'text-ink-4' : undefined}>
                    <Td>{label}</Td>
                    <Td className="text-[11.5px] text-ink-4">{line}</Td>
                    <Td numeric>{usdAccounting(amount)}</Td>
                  </tr>
                ))}
                <TotalRow>
                  <Td>Total modeled income</Td>
                  <Td className="text-[11.5px] font-normal text-ink-4">
                    excludes tax-exempt interest
                  </Td>
                  <Td numeric>{usd(income.totalModeledIncome)}</Td>
                </TotalRow>
              </tbody>
            </Table>
          </TableWrap>
        </Panel>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Deductions on file">
          <StatLine label="Charitable — cash to public charities" value={usd(client.deductions.charitableCash)} />
          <StatLine
            label="Charitable — appreciated securities"
            value={usd(client.deductions.charitableAppreciatedSecurities)}
          />
          <StatLine
            label="Charitable — private foundation"
            value={usd(client.deductions.charitablePrivateFoundation)}
          />
          <StatLine label="Charitable carryforward from prior years" value={usd(client.deductions.charitableCarryforward)} indent />
          <StatLine label="State and local taxes paid" value={usd(client.deductions.stateAndLocalTaxesPaid)} />
          <StatLine label="Mortgage interest" value={usd(client.deductions.mortgageInterest)} />
          <StatLine label="Medical expenses" value={usd(client.deductions.medicalExpenses)} />
          <StatLine label="Investment interest expense" value={usd(client.deductions.investmentInterestExpense)} />
        </Panel>

        <Panel title="Balance sheet">
          <StatLine label="Cash and equivalents" value={usd(bs.cashAndEquivalents)} />
          <StatLine label="Marketable portfolio" value={usd(bs.marketablePortfolio)} />
          <StatLine label="Concentrated positions" value={usd(concentrated)} />
          <StatLine label="Private business interests" value={usd(bs.privateBusinessInterests)} />
          <StatLine label="Retirement accounts" value={usd(bs.retirementAccounts)} />
          <StatLine label="Real estate at market value" value={usd(realEstateValue)} />
          <StatLine label="Mortgages" value={usdAccounting(-mortgages)} indent />
          <StatLine label="Other liabilities" value={usdAccounting(-bs.otherLiabilities)} indent />
          <StatLine label="Modeled net worth" value={usd(netWorth)} emphasis />

          {bs.concentratedPositions.length > 0 && (
            <div className="mt-4">
              <div className="eyebrow mb-1.5">Concentrated positions</div>
              {bs.concentratedPositions.map((position) => (
                <div key={position.label} className="border-t border-rule pt-2 text-[12.5px]">
                  <div className="font-medium text-ink">{position.label}</div>
                  <div className="tnum mt-0.5 text-ink-3">
                    {usd(position.marketValue)} market value · {usd(position.costBasis)} basis ·{' '}
                    {usd(position.marketValue - position.costBasis)} embedded gain
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-ink-4">{position.acquiredVia}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="Real estate" bodyClassName="p-0">
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Property</Th>
                <Th>Location</Th>
                <Th>Use</Th>
                <Th numeric>Market value</Th>
                <Th numeric>Cost basis</Th>
                <Th numeric>Mortgage</Th>
                <Th numeric>Equity</Th>
              </tr>
            </thead>
            <tbody>
              {bs.realEstate.map((holding) => (
                <tr key={`${holding.label}-${holding.location}`}>
                  <Td>{holding.label}</Td>
                  <Td className="text-ink-3">{holding.location}</Td>
                  <Td className="text-ink-3">{REAL_ESTATE_USE[holding.use]}</Td>
                  <Td numeric>{usd(holding.marketValue)}</Td>
                  <Td numeric>{usd(holding.costBasis)}</Td>
                  <Td numeric>{usdAccounting(holding.mortgageBalance)}</Td>
                  <Td numeric>{usd(holding.marketValue - holding.mortgageBalance)}</Td>
                </tr>
              ))}
              <TotalRow>
                <Td colSpan={3}>Total</Td>
                <Td numeric>{usd(realEstateValue)}</Td>
                <Td numeric>{usd(bs.realEstate.reduce((s, r) => s + r.costBasis, 0))}</Td>
                <Td numeric>{usdAccounting(mortgages)}</Td>
                <Td numeric>{usd(realEstateValue - mortgages)}</Td>
              </TotalRow>
            </tbody>
          </Table>
        </TableWrap>
      </Panel>

      <Panel className="mt-4" title="Transfers made during the year" bodyClassName="p-0">
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Recipient</Th>
                <Th>Relationship</Th>
                <Th>Asset</Th>
                <Th numeric>Amount</Th>
                <Th numeric>Cost basis</Th>
                <Th>Interest</Th>
                <Th>Splitting</Th>
              </tr>
            </thead>
            <tbody>
              {client.gifts.map((gift) => (
                <tr key={gift.id}>
                  <Td>
                    {gift.recipient}
                    {gift.note && (
                      <div className="mt-0.5 text-[11.5px] text-ink-4">{gift.note}</div>
                    )}
                  </Td>
                  <Td className="text-ink-3">{gift.relationship}</Td>
                  <Td className="text-ink-3">{GIFT_ASSET_LABELS[gift.assetType]}</Td>
                  <Td numeric>{usd(gift.amount)}</Td>
                  <Td numeric>{gift.costBasis === undefined ? '—' : usd(gift.costBasis)}</Td>
                  <Td className="text-ink-3">
                    {gift.presentInterest || (gift.intoTrust && gift.crummeyWithdrawalRight)
                      ? 'Present'
                      : 'Future'}
                    {gift.intoTrust && (
                      <span className="text-ink-4">
                        {' '}
                        · in trust{gift.crummeyWithdrawalRight ? ', withdrawal right' : ''}
                      </span>
                    )}
                  </Td>
                  <Td className="text-ink-3">{gift.spouseElectsGiftSplitting ? 'Elected' : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Panel>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Trusts" bodyClassName="p-0">
          {client.trusts.length === 0 ? (
            <p className="px-4 py-6 text-[12.5px] text-ink-3">No trusts on file.</p>
          ) : (
            <ul>
              {client.trusts.map((trust) => (
                <li key={trust.id} className="border-b border-rule px-4 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[12.5px] font-medium text-ink">{trust.name}</div>
                      <div className="mt-0.5 text-[11.5px] text-ink-3">
                        {TRUST_KIND_LABELS[trust.kind]} · {trust.situs} · established{' '}
                        {trust.yearEstablished}
                      </div>
                    </div>
                    <span className="tnum shrink-0 text-[12.5px] text-ink-2">
                      {usd(trust.principalValue)}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[11.5px] text-ink-3">
                    Trustee {trust.trustee} · beneficiaries {trust.beneficiaries.join(', ')}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {trust.isForeignTrust && <Tag>Foreign trust</Tag>}
                    {trust.hasNonresidentAlienBeneficiary && <Tag>Nonresident alien beneficiary</Tag>}
                    {trust.capitalGainsAllocatedToIncome ? (
                      <Tag>Gains allocated to income</Tag>
                    ) : (
                      <Tag>Gains allocated to principal</Tag>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Foreign financial accounts and entities" bodyClassName="p-0">
          {client.foreignAccounts.length === 0 && client.foreignEntities.length === 0 ? (
            <p className="px-4 py-6 text-[12.5px] text-ink-3">
              No foreign financial accounts or foreign entity interests are recorded.
            </p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Institution or entity</Th>
                    <Th>Country</Th>
                    <Th>Type</Th>
                    <Th numeric>Maximum value</Th>
                  </tr>
                </thead>
                <tbody>
                  {client.foreignAccounts.map((account) => (
                    <tr key={account.id}>
                      <Td>{account.institution}</Td>
                      <Td className="text-ink-3">{account.country}</Td>
                      <Td className="text-ink-3">
                        {FOREIGN_ACCOUNT_TYPE_LABELS[account.accountType]}
                      </Td>
                      <Td numeric>{usd(account.maximumValueUSD)}</Td>
                    </tr>
                  ))}
                  {client.foreignEntities.map((entity) => (
                    <tr key={entity.id}>
                      <Td>{entity.name}</Td>
                      <Td className="text-ink-3">{entity.country}</Td>
                      <Td className="text-ink-3">
                        {FOREIGN_ENTITY_LABELS[entity.kind]} · {pct(entity.ownershipPercent, 2)}
                      </Td>
                      <Td numeric>{usd(entity.valueUSD)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Panel>
      </div>
    </>
  );
}

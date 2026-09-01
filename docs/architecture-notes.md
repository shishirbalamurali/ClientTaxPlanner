# Design notes

Working notes on decisions that are not obvious from the code. Kept short on purpose.

## Why the rule engine returns the whole chain

An early version had rules return a severity and a message, and the UI reconstructed the citation
from a rule-to-authority lookup at render time. That worked until two rules cited the same authority
for different reasons and the panel started showing the wrong description next to the wrong finding.

Findings now carry `clientFact`, `measurement`, `analysis`, `potentialForms`, `authorityIds` and
`questionsForReview`, all built inside `evaluate`. Nothing about a finding is derived after
evaluation. The cost is a little repetition in the rule files; the benefit is that the chain shown
in "Why was this flagged?" cannot drift from the logic that produced it.

## Why constants are keyed to authority ids

`TaxYearConstants.sourceKeys` maps each block of figures to an id in the research library rather
than carrying a citation string. Strings drift. An id fails loudly: `getAuthority` throws on an
unknown key, and a test walks every `sourceKey` and asserts it resolves. Adding a 2026 file means
adding the amounts and pointing at the sources; forgetting a source is a test failure, not a silent
blank in the UI.

## Why the annual exclusion test is not `amount > 19000`

Three facts change the answer and none of them is the amount:

- a transfer in trust is a future interest unless the beneficiary holds a withdrawal right, and the
  exclusion does not reach a future interest at any amount
- a § 2513 election doubles the exclusion available for that donee
- a non-citizen spouse gets § 2523(i) rather than the unlimited marital deduction

`analyzeGifts` aggregates by donee first, resolves the exclusion that applies to that donee, then
measures. The per-gift amount never drives the test on its own.

## Why capital gains allocated to principal matter

`TrustRecord.capitalGainsAllocatedToIncome` looks like a detail and decides the outcome. Gain
allocated to principal is outside distributable net income, so it cannot be carried out to
beneficiaries and is taxed at the compressed rates even where the trust distributes all of its
accounting income. Modelling trust income as one number would hide the most consequential fact on
the page.

## Why a seeded generator rather than fixtures

The three sample clients exercise about two thirds of the rules. The rest — non-citizen spouse
transfers, PFIC holdings, nonresident alien beneficiaries — need fact patterns that would make the
samples unrealistic if forced in. `generateCohort` builds 100 records from a seeded PRNG, and a test
asserts that every rule in the catalogue fires at least once across them. The seed makes a failure
reproducible; without one, a flaky rule would be untraceable.

## Why the model states what it does not do

`MODEL_LIMITATIONS` is a single exported list, rendered on the Individual Tax page, on the Scenario
Analysis page, in the executive summary and in every Excel assumptions block. A reader who sees a
tax figure should see, in the same view, that AMT and § 199A are screened rather than computed.
Keeping the list in one place means it cannot be current in one view and stale in another.

import type {
  FilingStatus,
  ForeignAccountInterest,
  ForeignAccountType,
  ForeignEntityKind,
  GiftAssetType,
  TrustKind,
} from '@/lib/types';

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: 'Single',
  marriedFilingJointly: 'Married filing jointly',
  marriedFilingSeparately: 'Married filing separately',
  headOfHousehold: 'Head of household',
  qualifyingSurvivingSpouse: 'Qualifying surviving spouse',
};

export const FILING_STATUS_SHORT: Record<FilingStatus, string> = {
  single: 'Single',
  marriedFilingJointly: 'MFJ',
  marriedFilingSeparately: 'MFS',
  headOfHousehold: 'HoH',
  qualifyingSurvivingSpouse: 'QSS',
};

export const GIFT_ASSET_LABELS: Record<GiftAssetType, string> = {
  cash: 'Cash',
  marketableSecurities: 'Marketable securities',
  realProperty: 'Real property',
  closelyHeldBusinessInterest: 'Closely held interest',
};

export const FOREIGN_ACCOUNT_TYPE_LABELS: Record<ForeignAccountType, string> = {
  depository: 'Depository',
  custodial: 'Custodial',
  brokerage: 'Brokerage',
  pooledInvestmentFund: 'Pooled investment fund',
  insuranceOrAnnuity: 'Insurance or annuity',
  pension: 'Pension',
};

export const FOREIGN_INTEREST_LABELS: Record<ForeignAccountInterest, string> = {
  ownerOfRecord: 'Owner of record',
  jointOwner: 'Joint owner',
  signatureAuthorityOnly: 'Signature authority only',
};

export const FOREIGN_ENTITY_LABELS: Record<ForeignEntityKind, string> = {
  foreignCorporation: 'Foreign corporation',
  foreignPartnership: 'Foreign partnership',
  passiveForeignInvestmentCompany: 'Passive foreign investment company',
  foreignTrust: 'Foreign trust',
};

export const TRUST_KIND_LABELS: Record<TrustKind, string> = {
  grantorRevocable: 'Revocable grantor trust',
  irrevocableNonGrantor: 'Irrevocable non-grantor trust',
  irrevocableGrantor: 'Irrevocable grantor trust',
  charitableRemainderUnitrust: 'Charitable remainder unitrust',
};

/** Settings › Vendors (sc-82): the organisation's directory, read 25 at a time in name order. */

export const VENDOR_CATEGORIES = [
  'catering',
  'venue',
  'flowers',
  'photography',
  'music',
  'transport',
  'staffing',
  'hire',
  'other',
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export type VendorView = 'inUse' | 'archived';

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  contactName: string | null;
  emailAddress: string | null;
  /** E.164, beside the country it was typed for. */
  phoneNumber: string | null;
  phoneCountryCode: string | null;
  website: string | null;
  address: string | null;
  note: string | null;
  /** When it was archived; null while it is in use. */
  archivedAt: string | null;
  /** How many of the organisation's events engage it, by a quote current or earlier (sc-87); the directory's rows carry it. */
  events: number;
}

/** What the form sends, every field as typed: the API trims, checks and stores them. */
export interface VendorTyped {
  name: string;
  category: string;
  contactName: string;
  emailAddress: string;
  phoneCountryCode: string;
  phoneNumber: string;
  website: string;
  address: string;
  note: string;
}

export interface VendorsLooking {
  view: VendorView;
  q: string;
  category: VendorCategory | null;
  page: number;
  /** Opens the page holding this vendor instead, when nothing is searched. */
  vendor?: string | null;
}

/** A page, with the counts the card and the menus show: the whole view's, whatever is searched. */
export interface VendorsPage {
  vendors: Vendor[];
  page: number;
  /** Every vendor the search and category match, not only this page's. */
  total: number;
  inUse: number;
  archived: number;
  /** Each category's count within the view. */
  categories: Record<VendorCategory, number>;
}

const isCategory = (value: unknown): value is VendorCategory =>
  VENDOR_CATEGORIES.includes(value as VendorCategory);

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export function asVendor(raw: unknown): Vendor | null {
  const row = raw as Record<string, unknown> | null;

  if (
    row == null ||
    typeof row.id !== 'string' ||
    typeof row.name !== 'string' ||
    !isCategory(row.category)
  )
    return null;

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    contactName: text(row.contactName),
    emailAddress: text(row.emailAddress),
    phoneNumber: text(row.phoneNumber),
    phoneCountryCode: text(row.phoneCountryCode),
    website: text(row.website),
    address: text(row.address),
    note: text(row.note),
    archivedAt: text(row.archivedAt),
    events: typeof row.events === 'number' ? row.events : 0,
  };
}

export function asVendorsPage(raw: unknown): VendorsPage | null {
  const body = raw as Record<string, unknown> | null;
  const rows = Array.isArray(body?.vendors) ? body.vendors.map(asVendor) : null;
  const counts = body?.categories as Record<string, unknown> | null | undefined;

  if (
    body == null ||
    rows == null ||
    rows.some((row) => row == null) ||
    typeof body.page !== 'number' ||
    typeof body.total !== 'number' ||
    typeof body.inUse !== 'number' ||
    typeof body.archived !== 'number' ||
    counts == null ||
    VENDOR_CATEGORIES.some((key) => typeof counts[key] !== 'number')
  )
    return null;

  return {
    vendors: rows as Vendor[],
    page: body.page,
    total: body.total,
    inUse: body.inUse,
    archived: body.archived,
    categories: Object.fromEntries(VENDOR_CATEGORIES.map((key) => [key, counts[key]])) as Record<
      VendorCategory,
      number
    >,
  };
}

export function vendorsQuery(looking: VendorsLooking): string {
  const query = new URLSearchParams();
  if (looking.view === 'archived') query.set('view', 'archived');
  if (looking.q.trim() !== '') query.set('q', looking.q.trim());
  if (looking.category != null) query.set('category', looking.category);
  if (looking.page > 1) query.set('page', String(looking.page));
  if (looking.vendor != null) query.set('vendor', looking.vendor);
  const search = query.toString();

  return search === '' ? '' : `?${search}`;
}

/**
 * boardTemplates.js — built-in board templates for the flexible-columns
 * engine (Phase 1, F1).
 *
 * Each template seeds a new board with a fixed `columns[]` array (in order),
 * the right `type` per column, and `settings.options` for any
 * `status` / `dropdown` / `tags` columns. The first column is always the
 * board's primary column (the row title).
 *
 * Column option ids (slug strings like `new`, `qualified`) are deliberately
 * human-readable so automations and reports can read them without a UI
 * round-trip.
 *
 * The list mirrors the phase doc (§F1 Target State). Stage / Property Type /
 * City / Lead Source option sets ship as the agreed-upon defaults; update
 * the seed list if Thoma changes scope (see phase-1-TODO §Pre-flight).
 */

const COLOR = {
  gray: '#6B7280',
  blue: '#2563EB',
  orange: '#D97706',
  green: '#16A34A',
  emerald: '#059669',
  red: '#DC2626',
  yellow: '#CA8A04',
  purple: '#7C3AED',
  cyan: '#0891B2',
  pink: '#DB2777',
};

const stageOptions = [
  { id: 'new', label: 'New', color: COLOR.gray, order: 0, isDefault: true },
  { id: 'contacted', label: 'Contacted', color: COLOR.blue, order: 1 },
  { id: 'qualified', label: 'Qualified', color: COLOR.cyan, order: 2 },
  { id: 'viewing_scheduled', label: 'Viewing Scheduled', color: COLOR.orange, order: 3 },
  { id: 'offer', label: 'Offer', color: COLOR.purple, order: 4 },
  { id: 'closed', label: 'Closed', color: COLOR.green, order: 5 },
  { id: 'lost', label: 'Lost', color: COLOR.red, order: 6 },
];

const propertyTypeOptions = [
  { id: 'condo', label: 'Condo', color: COLOR.blue, order: 0 },
  { id: 'house', label: 'House', color: COLOR.green, order: 1 },
  { id: 'townhouse', label: 'Townhouse', color: COLOR.orange, order: 2 },
  { id: 'land', label: 'Land', color: COLOR.emerald, order: 3 },
  { id: 'commercial', label: 'Commercial', color: COLOR.purple, order: 4 },
];

const cityOptions = [
  { id: 'edmonton', label: 'Edmonton', color: COLOR.blue, order: 0 },
  { id: 'saskatoon', label: 'Saskatoon', color: COLOR.green, order: 1 },
  { id: 'regina', label: 'Regina', color: COLOR.orange, order: 2 },
  { id: 'montreal', label: 'Montreal', color: COLOR.purple, order: 3 },
];

const leadSourceOptions = [
  { id: 'website', label: 'Website', color: COLOR.blue, order: 0 },
  { id: 'zillow', label: 'Zillow', color: COLOR.cyan, order: 1 },
  { id: 'referral', label: 'Referral', color: COLOR.green, order: 2 },
  { id: 'walk_in', label: 'Walk-in', color: COLOR.orange, order: 3 },
  { id: 'ad', label: 'Ad', color: COLOR.pink, order: 4 },
  { id: 'other', label: 'Other', color: COLOR.gray, order: 5 },
];

const priorityOptions = [
  { id: 'critical', label: 'Critical', color: COLOR.red, order: 0 },
  { id: 'high', label: 'High', color: COLOR.orange, order: 1 },
  { id: 'medium', label: 'Medium', color: COLOR.yellow, order: 2, isDefault: true },
  { id: 'low', label: 'Low', color: COLOR.gray, order: 3 },
];

const realEstateLeads = {
  id: 'real_estate_leads',
  name: 'Real Estate Leads',
  description: 'Lead pipeline for real-estate agents: contact, qualify, view, offer, close.',
  columns: [
    { key: 'lead_name',     name: 'Lead Name',     type: 'text',      isPrimary: true },
    { key: 'stage',         name: 'Stage',         type: 'status',    settings: { options: stageOptions } },
    { key: 'property_type', name: 'Property Type', type: 'dropdown',  settings: { options: propertyTypeOptions } },
    { key: 'city',          name: 'City',          type: 'dropdown',  settings: { options: cityOptions } },
    { key: 'price_range',   name: 'Price Range',   type: 'number',    settings: { min: 0 } },
    { key: 'lead_source',   name: 'Lead Source',   type: 'dropdown',  settings: { options: leadSourceOptions } },
    { key: 'agent',         name: 'Agent',         type: 'person' },
    { key: 'move_in_date',  name: 'Move-in Date',  type: 'date' },
    { key: 'phone',         name: 'Phone',         type: 'phone' },
    { key: 'email',         name: 'Email',         type: 'email' },
    { key: 'notes',         name: 'Notes',         type: 'long_text' },
    { key: 'score',         name: 'Score',         type: 'number',    settings: { min: 0, max: 100 }, readOnly: true },
  ],
};

const boardTemplates = [realEstateLeads];

const getBoardTemplate = (id) =>
  boardTemplates.find((t) => t.id === id) || null;

/**
 * Materialise a template's `columns[]` into the shape expected by the
 * Board schema's `columns` subdoc (assigns `order`, defaults `width`,
 * defaults missing `settings` to `{}`, ensures exactly one isPrimary).
 *
 * Returns a plain array — caller pushes into `board.columns` and saves.
 */
const materializeTemplateColumns = (template) => {
  if (!template || !Array.isArray(template.columns)) return [];
  const out = template.columns.map((c, i) => ({
    key: c.key,
    name: c.name,
    type: c.type,
    settings: c.settings || {},
    order: i,
    width: c.width || 160,
    isPrimary: !!c.isPrimary,
  }));
  if (out.length > 0 && !out.some((c) => c.isPrimary)) {
    out[0].isPrimary = true;
  }
  return out;
};

module.exports = {
  boardTemplates,
  getBoardTemplate,
  materializeTemplateColumns,
};

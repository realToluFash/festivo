import { tokens } from '../../theme/tokens.ts';

/** Seating's colours the token file lacks, in one place as proposed tokens for docs/design/tokens.mjs (sc-3998, sc-4013, sc-4719): the demo adds no token itself. */
export const PROPOSED = {
  sectionPlum: '#B0479A',
  sectionWine: '#8E3B5E',
  sectionBrown: '#8A5A3C',
  sectionOlive: '#6B8E23',
  seatTaken: '#34343F',
  seatEdge: '#8B8B9A',
  seatUnusable: '#D3D3DB',
  seatUnusableEdge: '#6E6E7E',
  roomGrid: '#F0F0F4',
  roomGridFive: '#E3E3EA',
  presence: ['#0369A1', '#6D28D9', '#86198F', '#9F1239', '#155E75', '#3730A3'],
} as const;

/** sc-3998's eight section colours, each named: four are the option tokens already, four are proposed. */
export const SECTION_COLOURS = [
  ['Blue', tokens.optionBlue],
  ['Purple', tokens.optionPurple],
  ['Plum', PROPOSED.sectionPlum],
  ['Wine', PROPOSED.sectionWine],
  ['Rose', tokens.optionRose],
  ['Brown', PROPOSED.sectionBrown],
  ['Olive', PROPOSED.sectionOlive],
  ['Teal', tokens.optionTeal],
] as const;

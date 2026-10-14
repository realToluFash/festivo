// Soirely design context · foundations · extracted from the 19 screens on Oct 14, 2026.
//
// THIS FILE IS THE SOURCE. Do not edit the generated outputs:
//   apps/web/src/tokens.css        — CSS custom properties
//   apps/mobile/src/theme/tokens.ts — the same values as a typed object
// Both come from `node scripts/build-tokens.mjs`, and a test fails if either
// has drifted from this file. Two hand-maintained copies of a colour diverge;
// that is the whole reason this is a generated pair.
//
// It is a verbatim copy of `design-context/tokens.js` in the Claude Design
// project, kept verbatim so a later extraction can be diffed against it rather
// than reconciled by hand. Its own annotations are part of the value: a `usage`
// note says what a token is for, PROPOSED marks a change rather than a
// description, and "Disagreements" / "Accidents" name where the screens
// contradict themselves. A PROPOSED value is not settled — see sc-80.
//
// Same names as the design's tokens.css (--colorInk ⇄ tokens.colorInk).

export const tokens = {
  // ── Colour · text and surfaces ─────────────────────────────────────────────
  colorInk: '#15171C', // primary text; also the dark surface (banners, toasts, speaker phone, support bar)
  colorInkSecondary: '#6B7280', // secondary text, 4.5:1 on white. The most-used colour in the product (1,026 uses)
  colorInkTertiary: '#9CA3AF', // decoration, placeholders, disabled text, the "Not coming" dot. Fails 4.5:1: never for information
  colorInkOnDark: '#FFFFFF',
  colorInkOnDarkSecondary: '#D1D5DB', // secondary text on dark surfaces (room screen, speaker phone, support bar, landing banner)
  colorPage: '#F5F6F8',
  colorCard: '#FFFFFF',
  colorInset: '#F6F7F9', // inset panels, open rows, hover on nav
  colorInsetBorder: '#ECEEF2', // inset border and card section dividers
  colorBorder: '#E6E8EC', // card border, table header line
  colorControlBorder: '#D9DCE2', // outlined buttons, chips, inputs
  colorNeutralFill: '#F1F2F4', // chips, avatars, neutral pills, disabled buttons; ALSO the row divider (1px) – one value, two roles
  colorTrack: '#D6D9E0', // bar tracks; the "no pick" option colour
  colorMarkEmpty: '#C9CED6', // empty status circle, dashed add-buttons, disabled primary buttons
  colorRowHover: '#FBFBFC',
  colorRowSelected: '#F3FAF6',
  colorBreadcrumbSlash: '#C4C8CF',
  colorDark: '#15171C', // same hex as colorInk, named for the role
  colorDarkInset: '#2C2F36', // toast "OK" button, support console search
  colorDarkBorder: '#3A3D45',
  // ── Colour · header tint (app headers and desktop top bars) ────────────────
  colorHeader: '#E9F0F9',
  colorHeaderBorder: '#D7E2F0',
  colorHeaderTrack: '#DCE5F1', // segmented-control track when it sits on the header
  // ── Colour · meaning. Every use also carries a word or a shape. ────────────
  colorAccent: '#1E9A64', // primary action, selected, done
  colorAccentHover: '#178556', // web only (hover)
  colorAccentTint: '#E8F5EE',
  colorAccentText: '#176B47', // green text on white/tint (4.5:1); green ink links
  colorAccentTintBorder: '#CDE9DA',
  colorAttention: '#B7791F', // in progress, waiting, stale, behind
  colorAttentionTint: '#FBF1DC',
  colorAttentionText: '#8A5A12',
  colorAttentionBorder: '#F1E2BC',
  colorAttentionWash: '#FFFDF7', // card background for "proposed" and soft warnings
  colorAttentionOnDark: '#E3A72F', // the live/failing dot on dark surfaces. Same hex as optionAmber (see "Accidents")
  colorBroken: '#C2410C', // broken, bounced, allergy outline
  colorBrokenTint: '#FDECE4',
  colorBrokenText: '#9A3412',
  // ── Colour · option palette (menu choices, groups). Always with a letter or word. ──
  optionGreen: '#1E9A64', // same hex as colorAccent – see "Disagreements"
  optionBlue: '#3B7DD8',
  optionAmber: '#E3A72F',
  optionPurple: '#8B6CD6',
  optionTeal: '#2A9D8F',
  optionRose: '#D96C8A',
  optionNone: '#D6D9E0', // "no pick" – same hex as colorTrack
  // ── Colour · scrims (web: rgba; native: same rgba on a full-screen View) ───
  scrimSheet: 'rgba(21,23,28,0.35)', // bottom sheets. Screens also use 0.25 and 0.3 – accidents
  scrimDialog: 'rgba(21,23,28,0.4)', // centred dialogs
  // ── Colour · print (black and white only) ──────────────────────────────────
  colorPrintInk: '#000000',

  // ── Type ───────────────────────────────────────────────────────────────────
  fontFamily: "'Instrument Sans', sans-serif", // all reading text, all names
  fontFamilyMono: "'JetBrains Mono', monospace", // times, codes, table numbers, counts in tickets, references, step numbers
  // Native: choose files by weight (Instrument Sans 400/500/600/700; JetBrains Mono 500/700), never by family name in a style.
  // size · weight · line height · letter spacing. Roles come from where the screens use them.
  typeDisplay: { size: 48, weight: 700, lineHeight: 1, letterSpacing: '-0.03em' }, // one big number per panel (Messaging reach, Import count); 52 once
  typeTitlePage: { size: 28, weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, // desktop page title; phone uses 26
  typeTitlePhone: { size: 26, weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, // phone page title (Events Home, RSVP use 26/28 inconsistently)
  typeTitleSection: { size: 16, weight: 700, lineHeight: 1.3, letterSpacing: '0' }, // card title
  typeTitleDialog: { size: 20, weight: 700, lineHeight: 1.2, letterSpacing: '0' }, // dialog and sheet titles; 22 on tablet sheets
  typeNumberTile: { size: 30, weight: 700, lineHeight: 1, letterSpacing: '-0.02em' }, // tile numbers; 32 and 34 also appear
  typeBody: { size: 14, weight: 400, lineHeight: 1.5, letterSpacing: '0' }, // desktop default (730 uses)
  typeBodyPhone: { size: 15, weight: 400, lineHeight: 1.5, letterSpacing: '0' }, // phone body and row titles
  typeBodyGuest: { size: 17, weight: 400, lineHeight: 1.5, letterSpacing: '0' }, // guest pages only
  typeRowTitle: { size: 15, weight: 600, lineHeight: 1.3, letterSpacing: '0' },
  typeSmall: { size: 13, weight: 400, lineHeight: 1.45, letterSpacing: '0' }, // secondary lines under titles
  typeMeta: { size: 12, weight: 400, lineHeight: 1.4, letterSpacing: '0' }, // timestamps, footnotes
  typeLabel: { size: 12, weight: 600, lineHeight: 1, letterSpacing: '0.1em' }, // UPPERCASE section labels
  typePill: { size: 12, weight: 600, lineHeight: 1, letterSpacing: '0' }, // status pills. Screens mostly use 11 – see "Accidents"
  typeButton: { size: 14, weight: 600, lineHeight: 1, letterSpacing: '0' }, // 44px buttons; 15 on phone primaries; 13 inside dense rows
  typeMonoTime: { size: 14, weight: 600, lineHeight: 1, letterSpacing: '0' }, // mono; 12–13 for provider strings, 20–26 for table numbers
  typeRoomNow: { size: 64, weight: 700, lineHeight: 1.05, letterSpacing: '-0.02em' }, // room screen only; 30 for "coming up", 20 for labels
  typeLandingH1: { size: 60, weight: 700, lineHeight: 1.02, letterSpacing: '-0.03em' }, // public pages only

  // ── Spacing (px). The set the screens use, not a scale. ────────────────────
  spaceHair: 2, // title-to-subtitle stacks (171 uses). 1 and 3 also occur – accidents
  spaceXxs: 4,
  spaceXs: 6, // chip gaps, pill wraps
  spaceSm: 8, // the default gap (352 uses)
  spaceMd: 10, // row content gap on phone
  spaceLg: 12, // card inner stacks, grid gaps
  spaceXl: 16, // between cards, phone side padding
  spaceXxl: 20, // desktop content gap, phone card padding, column gaps
  space3xl: 24, // desktop card padding
  space4xl: 28, // desktop content top padding
  space5xl: 32, // desktop content side padding
  space6xl: 40, // between frames (documentation canvas only)

  // ── Sizing (px) ────────────────────────────────────────────────────────────
  sizeHit: 44, // every button, chip, row, checkbox, stepper; desktop included (482 uses)
  sizeHitPhonePrimary: 48, // phone primary buttons and inputs
  sizeHitPhoneHero: 52, // one-per-screen phone CTA ("I'm here" uses 56 – accident)
  sizeSegmentInner: 38, // button inside a 44px segmented track (track padding 3)
  sizeControlDense: 36, // buttons inside dense rows – VIOLATES the 44 rule, see "Disagreements"
  sizePill: 22, // status/badge pill height; 20 and 24 also used
  sizeMark: 20, // status mark circle in rows; 22 in headers, 18 in compact lists, 24 on tickets
  sizeAvatar: 36, // rows; 32 compact, 40 phone lists, 44 headers
  sizeSeat: 36, // seat square on tablet
  sizeBar: 6, // progress bar; 8 phone, 10 panels
  sizeToggleW: 40,
  sizeToggleH: 24,
  sizeToggleKnob: 20, // Roles uses 48×28 – accident
  sizeTopBar: 60, // desktop top bar
  sizeRail: 240, // desktop sidebar
  sizePhoneStatus: 54,
  sizePhoneTabBar: 84,
  sizeTabletStatus: 40,
  sizePanel: 380, // desktop right panel. Screens use 300, 320, 360, 380, 400, 420 – see "Disagreements"

  // ── Radius (px). Pills are height/2. ───────────────────────────────────────
  radiusPill: 9999, // written as 22 (44px), 24 (48px), 26 (52px), 11 (22px) in the screens
  radiusCardDesktop: 16,
  radiusCardPhone: 18, // phone/tablet cards and tiles
  radiusCardLarge: 20, // emphasised panels (Messaging reach, Billing summary, landing dark card)
  radiusInset: 14,
  radiusField: 12, // inputs; desktop Messaging uses 10 – accident
  radiusNav: 10, // sidebar items, small inset boxes
  radiusSmall: 8, // seat squares, small badges
  radiusCheckbox: 6, // 7 appears once
  radiusSheet: 28, // top corners of bottom sheets
  radiusFramePhone: 48,
  radiusFrameTablet: 36,
  radiusFrameDesktop: 16, // documentation frames only

  // ── Borders ────────────────────────────────────────────────────────────────
  borderCard: '1px solid #E6E8EC',
  borderControl: '1px solid #D9DCE2',
  borderInset: '1px solid #ECEEF2',
  borderDivider: '1px solid #F1F2F4',
  borderHeader: '1px solid #D7E2F0',
  borderSelected: '2px solid #1E9A64',
  borderMark: '1.5px solid', // + the status colour
  borderMarkProgress: '3px solid #B7791F', // the amber half-circle is a 3px ring
  borderAllergy: '1.5px solid #C2410C', // lists; tickets use 2px – see "Disagreements"
  borderProposed: '1.5px dashed #B7791F',
  borderAdd: '1px dashed #C9CED6',
  borderGuestControl: '1.5px solid #D9DCE2', // guest pages only, thicker on purpose

  // ── Shadow / elevation. Web values; native equivalents below. ──────────────
  shadowCard: '0 1px 2px rgba(20,22,28,0.04)', // level 1 · most desktop cards
  shadowRaised: '0 1px 2px rgba(20,22,28,0.04), 0 8px 24px rgba(20,22,28,0.05)', // level 2 · emphasised panels
  shadowPopover: '0 2px 4px rgba(20,22,28,0.05), 0 20px 50px rgba(20,22,28,0.2)', // level 3 · floating panels (assistant on tablet)
  shadowDialog: '0 2px 4px rgba(20,22,28,0.05), 0 24px 60px rgba(20,22,28,0.3)', // level 4 · centred dialogs
  shadowSheet: '0 -12px 40px rgba(20,22,28,0.2)', // level 4 · bottom sheets (0 -8px 40px 0.16 also used)
  shadowToast: '0 12px 32px rgba(20,22,28,0.3)', // level 5
  shadowKnob: '0 1px 2px rgba(20,22,28,0.2)',
  shadowFrame: '0 1px 2px rgba(20,22,28,0.06), 0 24px 60px rgba(20,22,28,0.12)', // documentation frames only
  // Native (React Native): shadows differ by platform; every elevated surface ALSO has a 1px border, so shadow is never structural.
  elevationNative: {
    card: {
      ios: {
        shadowColor: '#14161C',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
    },
    raised: {
      ios: {
        shadowColor: '#14161C',
        shadowOpacity: 0.06,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 3 },
    },
    popover: {
      ios: {
        shadowColor: '#14161C',
        shadowOpacity: 0.16,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 12 },
      },
      android: { elevation: 8 },
    },
    dialog: {
      ios: {
        shadowColor: '#14161C',
        shadowOpacity: 0.24,
        shadowRadius: 36,
        shadowOffset: { width: 0, height: 16 },
      },
      android: { elevation: 12 },
    },
    sheet: {
      ios: {
        shadowColor: '#14161C',
        shadowOpacity: 0.16,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: -8 },
      },
      android: { elevation: 12 },
    },
    toast: {
      ios: {
        shadowColor: '#14161C',
        shadowOpacity: 0.24,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 16 },
    },
  },

  // ── Meaning · marks. A shape and a word, never colour alone. ───────────────
  marks: {
    done: { glyph: '✓', word: 'Done', fill: '#1E9A64', ring: '#1E9A64', ink: '#FFFFFF' },
    progress: { glyph: '…', word: 'In progress', fill: '#FBF1DC', ring: '#B7791F', ink: '#B7791F' }, // header variant: 3px #B7791F ring, white fill, no glyph
    broken: { glyph: '✕', word: 'Broken', fill: '#FFFFFF', ring: '#C2410C', ink: '#C2410C' },
    notStarted: {
      glyph: '',
      word: 'Not started',
      fill: '#FFFFFF',
      ring: '#C9CED6',
      ink: 'transparent',
    },
    skipped: { glyph: '–', word: 'Skipped', fill: '#F1F2F4', ring: '#C9CED6', ink: '#6B7280' },
    allergy: { glyph: '!', word: 'Allergy', fill: '#FFFFFF', ring: '#C2410C', ink: '#C2410C' }, // ring 1.5–2px; always listed first
    info: { glyph: 'i', word: '', fill: '#FFFFFF', ring: '#4B5563', ink: '#4B5563' },
  },
  replyStates: {
    coming: { word: 'Coming', dot: '#1E9A64', ring: '0' },
    maybe: { word: 'Maybe', dot: '#FBF1DC', ring: '3px solid #B7791F' },
    notComing: { word: 'Not coming', dot: '#9CA3AF', ring: '0' },
    held: { word: 'Held', dot: 'half #6B7280 / #FFFFFF', ring: '1px solid #6B7280' }, // web: linear-gradient 90deg 50%; native: two Views
    noReply: { word: 'No reply', dot: 'transparent', ring: '1.5px solid #9CA3AF' },
  },
  seatStates: {
    taken: {
      glyph: '✓',
      word: 'Taken',
      fill: '#1E9A64',
      ring: '1px solid #1E9A64',
      ink: '#FFFFFF',
    },
    proposed: {
      glyph: '?',
      word: 'Proposed',
      fill: '#FFFDF7',
      ring: '1.5px dashed #B7791F',
      ink: '#8A5A12',
    },
    held: {
      glyph: '',
      word: 'Held for a companion',
      fill: 'half #6B7280 / #FFFFFF',
      ring: '1px solid #6B7280',
      ink: 'transparent',
    },
    empty: {
      glyph: '',
      word: 'Empty',
      fill: '#FFFFFF',
      ring: '1px solid #C9CED6',
      ink: 'transparent',
    },
    unusable: {
      glyph: '✕',
      word: 'Unusable',
      fill: '#F1F2F4',
      ring: '1px solid #C9CED6',
      ink: '#6B7280',
    },
  },

  // ── Motion. The prototype animates nothing; these are PROPOSED for the behaviour batch. ──
  motionFast: 120,
  motionBase: 200,
  motionSlow: 320, // ms
  motionEase: 'cubic-bezier(0.2, 0, 0, 1)',
  toastLifetime: 10000, // ms · every undo toast in the screens lives 10 s (8 s on Insights – accident)
};

export default tokens;

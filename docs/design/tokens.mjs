// Soirely design context · foundations · extracted from the 19 screens on Oct 14, 2026.
//
// THIS FILE IS THE SOURCE. Do not edit the generated outputs:
//   apps/web/src/tokens.css        — CSS custom properties
//   apps/mobile/src/theme/tokens.ts — the same values as a typed object
// Both come from `node scripts/build-tokens.mjs`, and a test fails if either
// has drifted from this file. Two hand-maintained copies of a colour diverge;
// that is the whole reason this is a generated pair.
//
// It began as a verbatim copy of `design-context/tokens.js` in the Claude
// Design project. Its own annotations are part of the value: a note says what a
// token is for, PROPOSED marks a change rather than a description, and
// "Disagreements" / "Accidents" name where the screens contradict themselves.
//
// FOUR DELIBERATE DIVERGENCES from that copy, settled under sc-80. Each is
// marked SETTLED at its token, and each is held by a test in
// scripts/build-tokens.test.mjs so that undoing one is a deliberate act:
//
//   1. hitSlopDense is new. The 36px dense control keeps its visual height and
//      gains the slop that brings its touch target to 44, because a visual
//      height and a hit area are different things and only one of them was
//      ever in contention.
//   2. typePill stays 12 against the screens' 11, and nothing a person reads
//      now goes below 12.
//   3. optionGreen moves off the accent's hex. A green-coded menu option was
//      indistinguishable from a selected one.
//   4. The reply states tell themselves apart by SHAPE; grey no longer comes in
//      two values, and the two that failed contrast are gone.
//
// SIX MORE, settled under sc-22092 and tested the same way: colorPrimaryHover,
// colorFieldBorder with borderField, colorPausedText with colorPausedTint,
// motionRise with opacityPressed, motionMax, and the motion block itself.

// Everything else is still the extraction's own value, so a later extraction
// can be diffed against this file and only these ten should show up.
//
// Same names as the design's tokens.css (--colorInk ⇄ tokens.colorInk).

export const tokens = {
  // ── Colour · text and surfaces ─────────────────────────────────────────────
  colorInk: '#15171C', // primary text; also the dark surface (banners, toasts, speaker phone, support bar)
  colorInkSecondary: '#5F6673', // secondary text, 4.5:1 on every light surface (lowest: colorHeaderTrack 4.55). The most-used colour in the product (1,026 uses)
  colorInkTertiary: '#9CA3AF', // decoration, placeholders, disabled text, the "Not coming" dot. Fails 4.5:1: never for information
  colorInkOnDark: '#FFFFFF',
  colorInkOnDarkSecondary: '#D1D5DB', // secondary text on dark surfaces (room screen, speaker phone, support bar, landing banner)
  colorPage: '#F5F6F8',
  colorCard: '#FFFFFF',
  colorInset: '#F6F7F9', // inset panels, open rows, hover on nav
  colorInsetBorder: '#ECEEF2', // inset border and card section dividers
  colorBorder: '#E6E8EC', // card border, table header line
  colorControlBorder: '#D9DCE2', // secondary and destructive buttons, chips: controls a word identifies, so the edge carries nothing (1.37:1). Never a text field's edge
  colorFieldBorder: '#80868F', // SETTLED (sc-22092): a text field's edge at rest and focused, 3:1 on colorCard (3.67), colorPage (3.39) and colorHeader (3.20)
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
  colorAccent: '#1E9A64', // selected, done, the focus ring: wherever no label sits on it (3.58:1 on white clears 3:1, not 4.5:1)
  colorAccentHover: '#178556', // the primary button's fill in both clients, under a white label (4.64:1). The name is the extraction's
  colorPrimaryHover: '#176B47', // SETTLED (sc-22092): the primary button on hover, web only, 6.50:1 under white. colorAccentText's hex, named for the role
  colorAccentTint: '#E8F5EE',
  colorAccentText: '#176B47', // green text on white/tint (4.5:1); green ink links
  colorAccentTintBorder: '#CDE9DA',
  colorAttention: '#B7791F', // in progress, waiting, stale, behind
  colorAttentionTint: '#FBF1DC',
  colorAttentionText: '#8A5A12',
  colorAttentionBorder: '#F1E2BC',
  colorAttentionWash: '#FFFDF7', // card background for "proposed" and soft warnings
  colorAttentionOnDark: '#E3A72F', // the live/failing dot on dark surfaces. SETTLED: deliberately the same hex as optionAmber — they never share a surface, and two roles naming one value is the point of role names
  colorBroken: '#C2410C', // broken, bounced, allergy outline
  colorBrokenTint: '#FDECE4',
  colorBrokenText: '#9A3412',
  colorPausedText: '#1F4E8C', // SETTLED (sc-22092): the Paused chip's word, 7.24:1 on its tint
  colorPausedTint: '#E9F0F9', // SETTLED (sc-22092): the Paused chip; colorHeader's hex, named for the role
  // ── Colour · option palette (menu choices, groups). Always with a letter or word. ──
  // SETTLED (sc-80). Was #1E9A64, the accent's own hex. The accent means
  // selected / done and cannot move, so the option moved: on the menu
  // screen a green-coded dish was indistinguishable from a selected one, which
  // is the one place the two genuinely meet. A yellower green, clear of both the
  // accent and the teal below it. The HUE is a proposal the designer may swap;
  // the RULE — no option colour may equal a colour that carries meaning — is
  // settled, and tested.
  optionGreen: '#6AA84F',
  optionBlue: '#3B7DD8',
  optionAmber: '#E3A72F',
  optionPurple: '#8B6CD6',
  optionTeal: '#2A9D8F',
  optionRose: '#D96C8A',
  optionNone: '#D6D9E0', // "no pick". SETTLED: deliberately the same hex as colorTrack — both mean absence, and changing one does not imply changing the other
  // ── Colour · scrims (web: rgba; native: same rgba on a full-screen View) ───
  scrimSheet: 'rgba(21,23,28,0.35)', // bottom sheets. Screens also use 0.25 and 0.3 – accidents
  scrimDialog: 'rgba(21,23,28,0.4)', // centred dialogs
  // ── Colour · print (black and white only) ──────────────────────────────────
  colorPrintInk: '#000000',

  // ── Type ───────────────────────────────────────────────────────────────────
  fontFamily: "'Instrument Sans', sans-serif", // every word: one face all through (owner, 3 Nov 2026)
  // Native: choose files by weight (Instrument Sans 400/500/600/700), never by family name in a style.
  // size · weight · line height · letter spacing. Roles come from where the screens use them.
  typeDisplay: { size: 48, weight: 700, lineHeight: 1, letterSpacing: '-0.03em' }, // one big number per panel (Messaging reach, Import count); 52 once
  typeTitlePage: { size: 28, weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, // desktop page title; phone uses 26
  typeTitlePhone: { size: 26, weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, // phone page title (Events Home, RSVP use 26/28 inconsistently)
  typeTitleFrame: { size: 34, weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, // the app's header band title on a phone, every screen (page 29, sc-26270)
  typeTitleFrameCompact: { size: 30, weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, // the same on an iPhone SE and both iPads (page 29, sc-26270)
  typeTitleStep: { size: 32, weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, // a sign-in step's title on a phone (B Confetti, sc-29078); a tablet's sheet takes typeTitleFrame
  typeCoverLine: { size: 32, weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, // the line under the brand on the sign-in cover, on a phone (sc-29078)
  typeCoverLineCompact: { size: 26, weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, // the same under 380 wide (sc-29078)
  typeCoverLineTablet: { size: 46, weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, // the same on a tablet (sc-29078)
  typeCoverTitle: { size: 28, weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, // No connection's title on the cover, on a phone (sc-29078)
  typeCoverTitleTablet: { size: 40, weight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }, // the same on a tablet (sc-29078)
  typeCoverBodyTablet: { size: 19, weight: 400, lineHeight: 1.5, letterSpacing: '0' }, // the words under a cover title on a tablet; a phone's take typeBodyGuest (sc-29078)
  typeTitleSection: { size: 16, weight: 700, lineHeight: 1.3, letterSpacing: '0' }, // card title
  typeTitleDialog: { size: 20, weight: 700, lineHeight: 1.2, letterSpacing: '0' }, // dialog and sheet titles; 22 on tablet sheets
  typeNumberTile: { size: 30, weight: 700, lineHeight: 1, letterSpacing: '-0.02em' }, // tile numbers; 32 and 34 also appear
  typeBody: { size: 14, weight: 400, lineHeight: 1.5, letterSpacing: '0' }, // desktop default (730 uses)
  typeBodyStrong: { size: 14, weight: 500, lineHeight: 1.5, letterSpacing: '0' }, // body at 500: Back, a field's label, a row's lead (sc-29065)
  typeBodyPhone: { size: 15, weight: 400, lineHeight: 1.5, letterSpacing: '0' }, // phone body and row titles
  typeBodyGuest: { size: 17, weight: 400, lineHeight: 1.5, letterSpacing: '0' }, // guest pages only
  typeRowTitle: { size: 15, weight: 600, lineHeight: 1.3, letterSpacing: '0' },
  typeSmall: { size: 13, weight: 400, lineHeight: 1.45, letterSpacing: '0' }, // secondary lines under titles
  typeSmallStrong: { size: 13, weight: 500, lineHeight: 1.45, letterSpacing: '0' }, // a step line, a rule's line, a tab's count (sc-29065)
  typeMeta: { size: 12, weight: 400, lineHeight: 1.4, letterSpacing: '0' }, // timestamps, footnotes
  typeLabel: { size: 12, weight: 600, lineHeight: 1, letterSpacing: '0.1em' }, // UPPERCASE section labels
  // SETTLED (sc-80). The screens mostly use 11; this file declared 12. 12 wins:
  // a status pill carries a WORD, because meaning never rests on colour alone,
  // and 11px is too small for the word to do that job. A declared value also
  // beats an accident. It makes 12 the floor for everything a person reads,
  // which is tested.
  typePill: { size: 12, weight: 600, lineHeight: 1, letterSpacing: '0' }, // status pills
  typePillWrapped: { size: 12, weight: 600, lineHeight: 1.25, letterSpacing: '0' }, // a status chip whose words wrap onto a second line at 320
  typeButton: { size: 14, weight: 600, lineHeight: 1, letterSpacing: '0' }, // 44px buttons; 15 on phone primaries; 13 inside dense rows
  typeCode: { size: 14, weight: 600, lineHeight: 1, letterSpacing: '0.04em' }, // codes read or copied by character, in Instrument Sans with tabular figures
  typeCodeField: { size: 18, weight: 500, lineHeight: 1, letterSpacing: '0.32em' }, // the one field a code is typed into, six digits wide (sc-29065)
  typeRoomNow: { size: 64, weight: 700, lineHeight: 1.05, letterSpacing: '-0.02em' }, // room screen only; 30 for "coming up", 20 for labels
  typeLandingH1: { size: 60, weight: 700, lineHeight: 1.02, letterSpacing: '-0.03em' }, // public pages only

  // ── Spacing (px). The set the screens use, not a scale. ────────────────────
  spaceHair: 2, // title-to-subtitle stacks (171 uses). 1 and 3 also occur – accidents
  spaceXxs: 4,
  spaceXs: 6, // chip gaps, pill wraps
  spaceSm: 8, // the default gap (352 uses)
  spaceMd: 10, // row content gap on phone
  spaceLg: 12, // card inner stacks, grid gaps
  spacePillEnd: 14, // the app's organisation pill, from its chevron to its edge (sc-23301)
  spaceXl: 16, // between cards, phone side padding
  spaceXxl: 20, // desktop content gap, phone card padding, column gaps
  space3xl: 24, // desktop card padding
  space4xl: 28, // desktop content top padding
  space5xl: 32, // desktop content side padding
  space6xl: 40, // between frames (documentation canvas only)

  // ── Sizing (px) ────────────────────────────────────────────────────────────
  sizeHit: 44, // every button, chip, row, checkbox, stepper; desktop included (482 uses)
  sizeControlDesktop: 40, // desktop web fields and buttons on the signed-out pages (sc-28983); the touch floor stays sizeHit
  sizeHitPhonePrimary: 48, // phone primary buttons and inputs
  sizeHitPhoneHero: 52, // one-per-screen phone CTA ("I'm here" uses 56 – accident)
  sizeListRow: 56, // sc-22092's List row, as the organisation switcher's rows (sc-26270)
  sizeSegmentInner: 38, // button inside a 44px segmented track (track padding 3)
  // SETTLED (sc-80). The design flagged this as violating the 44 rule. It does
  // not: 36 is how tall the control LOOKS, and 44 is how big the target must
  // be. Those are different properties, and conflating them is what made this
  // look like a contradiction. A dense control is drawn at 36 and carries
  // `hitSlopDense` on every side — hitSlop on native, padding on the web — so
  // the thing a finger hits is 44. The invariant is tested.
  sizeControlDense: 36, // buttons inside dense rows; visual height only
  hitSlopDense: 4, // (44 − 36) / 2 · every dense control carries this on all four sides
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
  radiusField: 8, // inputs: text, code, select and search fields (sc-28849)
  radiusRow: 12, // list rows, notices, inner boxes, skeletons; desktop Messaging uses 10 – accident
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
  borderField: '1px solid #80868F', // SETTLED (sc-22092): a text field's edge, colorFieldBorder
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
  // SETTLED (sc-80). Two of these used #9CA3AF, which this file says itself
  // fails 4.5:1 and must never carry information — and a status dot carries
  // information even when a word sits beside it.
  //
  // So the system is now: colour separates only yes (green), maybe (amber) and
  // not-yes (one grey, #6B7280, which passes), and SHAPE says which kind of
  // not-yes it is — solid, half, or an empty ring. That is stronger than three
  // greys would have been, because it survives the greyscale print the kitchen
  // makes, and because Held stops being a shade away from No reply.
  replyStates: {
    coming: { word: 'Coming', dot: '#1E9A64', ring: '0' }, // solid green
    maybe: { word: 'Maybe', dot: '#FBF1DC', ring: '3px solid #B7791F' }, // amber ring
    notComing: { word: 'Not coming', dot: '#6B7280', ring: '0' }, // solid grey
    held: { word: 'Held', dot: 'half #6B7280 / #FFFFFF', ring: '1px solid #6B7280' }, // half grey · web: linear-gradient 90deg 50%; native: two Views
    noReply: { word: 'No reply', dot: 'transparent', ring: '1.5px solid #6B7280' }, // empty grey ring
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

  // ── Motion. SETTLED (sc-22092): both clients use these; reduced, a fade of at most motionBase or none. ──
  motionFast: 120, // an exit, a press
  motionBase: 200, // a fade, a rise
  motionSlow: 320, // ms · a sheet rising
  motionEase: 'cubic-bezier(0.2, 0, 0, 1)',
  motionMax: 500, // ms · SETTLED (sc-22092): no interface transition lasts longer, so motion never makes somebody wait
  motionRise: 8, // px · SETTLED (sc-22092): how far a page or a dialog rises as it fades in
  opacityPressed: 0.85, // SETTLED (sc-22092): a pressed button, back in motionFast
  motionPulse: 1400, // ms · SETTLED (sc-23303): one breath of a waiting skeleton; a loop, not a transition, so not held to motionMax
  motionPulseTimes: 3, // SETTLED (sc-23303): 4.2 s of breathing, inside WCAG 2.2.2's five seconds, then still
  opacityPulse: 0.55, // SETTLED (sc-23303): how far a waiting skeleton dims at the middle of each breath
  toastLifetime: 10000, // ms · every undo toast in the screens lives 10 s (8 s on Insights – accident)
};

// ── B Confetti's colour schemes (owner, 3 Nov 2026; page 29, Colours.dc.html). ──
// EXPO_PUBLIC_SCHEME lays one over the tokens above; unset, it is defaultScheme (sc-30410).
export const defaultScheme = 'violet';

export const schemes = {
  violet: {
    colorInk: '#0D0D12',
    colorDark: '#0D0D12',
    colorPage: '#FFFFFF',
    colorInset: '#F4F4F7',
    colorInsetBorder: '#EAEAF0',
    colorBorder: '#E4E4EC',
    colorControlBorder: '#D7D7DF',
    colorNeutralFill: '#EFEFF4',
    colorRowSelected: '#F7F5FE',
    colorAccent: '#5A3DF0',
    colorAccentHover: '#5A3DF0',
    colorPrimaryHover: '#4A32C5',
    colorAccentTint: '#EEECFE',
    colorAccentTintBorder: '#DBD4FC',
    colorAccentText: '#5A3DF0',
    colorInkTertiary: '#9898A6',
    colorInkSecondary: '#565666',
    colorFieldBorder: '#888897',
    colorBroken: '#C42B1C',
    colorBrokenText: '#A3241A',
  },
  cobalt: {
    colorInk: '#0B1220',
    colorDark: '#0B1220',
    colorPage: '#FFFFFF',
    colorInset: '#F3F5FA',
    colorInsetBorder: '#E7EBF4',
    colorBorder: '#E1E6F0',
    colorControlBorder: '#D4D9E4',
    colorNeutralFill: '#EDF0F7',
    colorRowSelected: '#F4F6FD',
    colorAccent: '#1F47D6',
    colorAccentHover: '#1F47D6',
    colorPrimaryHover: '#193AAF',
    colorAccentTint: '#E9EDFB',
    colorAccentTintBorder: '#CED7F6',
    colorAccentText: '#1F47D6',
    colorInkTertiary: '#94A0B4',
    colorInkSecondary: '#4A5568',
    colorFieldBorder: '#838A97',
    colorBroken: '#C42B1C',
    colorBrokenText: '#A3241A',
  },
  garden: {
    colorInk: '#17201B',
    colorDark: '#17201B',
    colorPage: '#FFFDF8',
    colorInset: '#F6F2EA',
    colorInsetBorder: '#ECE6DA',
    colorBorder: '#E6E0D4',
    colorControlBorder: '#DAD4C9',
    colorNeutralFill: '#F1ECE2',
    colorRowSelected: '#F4F8F6',
    colorAccent: '#1E6B4F',
    colorAccentHover: '#1E6B4F',
    colorPrimaryHover: '#195841',
    colorAccentTint: '#E8F0ED',
    colorAccentTintBorder: '#CEDED8',
    colorAccentText: '#1E6B4F',
    colorInkTertiary: '#9AA39D',
    colorInkSecondary: '#55605A',
    colorFieldBorder: '#848C88',
    colorBroken: '#C42B1C',
    colorBrokenText: '#A3241A',
  },
  citrus: {
    colorInk: '#1F140C',
    colorDark: '#1F140C',
    colorPage: '#FFFFFF',
    colorInset: '#FBF5EF',
    colorInsetBorder: '#F3EADF',
    colorBorder: '#EFE4D8',
    colorControlBorder: '#E3D8CC',
    colorNeutralFill: '#F7F0E7',
    colorRowSelected: '#FCF6F3',
    colorAccent: '#C2410C',
    colorAccentHover: '#C2410C',
    colorPrimaryHover: '#9F350A',
    colorAccentTint: '#F9ECE7',
    colorAccentTintBorder: '#F2D5CA',
    colorAccentText: '#C0400C',
    colorInkTertiary: '#A3958A',
    colorInkSecondary: '#5E5148',
    colorFieldBorder: '#918882',
    colorBroken: '#C42B1C',
    colorBrokenText: '#A3241A',
  },
  berry: {
    colorInk: '#1E0F16',
    colorDark: '#1E0F16',
    colorPage: '#FFFFFF',
    colorInset: '#FBF4F6',
    colorInsetBorder: '#F3E6EB',
    colorBorder: '#EEDFE5',
    colorControlBorder: '#E2D3D9',
    colorNeutralFill: '#F7EDF0',
    colorRowSelected: '#FBF3F7',
    colorAccent: '#B5175A',
    colorAccentHover: '#B5175A',
    colorPrimaryHover: '#94134A',
    colorAccentTint: '#F8E8EE',
    colorAccentTintBorder: '#EFCCDB',
    colorAccentText: '#B5175A',
    colorInkTertiary: '#A3909A',
    colorInkSecondary: '#5D4952',
    colorFieldBorder: '#918389',
    colorBroken: '#C42B1C',
    colorBrokenText: '#A3241A',
  },
  blacktie: {
    colorInk: '#141414',
    colorDark: '#141414',
    colorPage: '#FFFDF9',
    colorInset: '#F4F1EA',
    colorInsetBorder: '#EAE5DA',
    colorBorder: '#E6E0D3',
    colorControlBorder: '#D9D4C8',
    colorNeutralFill: '#EFEBE2',
    colorRowSelected: '#F3F3F3',
    colorAccent: '#141414',
    colorAccentHover: '#141414',
    colorPrimaryHover: '#353535',
    colorAccentTint: '#E8E8E8',
    colorAccentTintBorder: '#CBCBCB',
    colorAccentText: '#141414',
    colorInkTertiary: '#A19A8D',
    colorInkSecondary: '#5A554C',
    colorFieldBorder: '#8D8983',
    colorBroken: '#C42B1C',
    colorBrokenText: '#A3241A',
  },
  sorbet: {
    colorInk: '#22152E',
    colorDark: '#22152E',
    colorPage: '#FFFBF7',
    colorInset: '#FBF3EE',
    colorInsetBorder: '#F2E7E0',
    colorBorder: '#EFE3DB',
    colorControlBorder: '#E3D7D1',
    colorNeutralFill: '#F6EDE7',
    colorRowSelected: '#F7F4F9',
    colorAccent: '#5B2A86',
    colorAccentHover: '#5B2A86',
    colorPrimaryHover: '#4B226E',
    colorAccentTint: '#EFEAF3',
    colorAccentTintBorder: '#DBD0E4',
    colorAccentText: '#5B2A86',
    colorInkTertiary: '#A396A9',
    colorInkSecondary: '#5E5266',
    colorFieldBorder: '#908795',
    colorBroken: '#C42B1C',
    colorBrokenText: '#A3241A',
  },
  terracotta: {
    colorInk: '#221811',
    colorDark: '#221811',
    colorPage: '#FFFCF7',
    colorInset: '#F7F0E6',
    colorInsetBorder: '#EEE3D4',
    colorBorder: '#EADFCF',
    colorControlBorder: '#DED3C4',
    colorNeutralFill: '#F2EADD',
    colorRowSelected: '#FAF5F4',
    colorAccent: '#A3401D',
    colorAccentHover: '#A3401D',
    colorPrimaryHover: '#863418',
    colorAccentTint: '#F6ECE8',
    colorAccentTintBorder: '#EBD5CD',
    colorAccentText: '#A3401D',
    colorInkTertiary: '#A39484',
    colorInkSecondary: '#5F5246',
    colorFieldBorder: '#918880',
    colorBroken: '#C42B1C',
    colorBrokenText: '#A3241A',
  },
};

export default tokens;

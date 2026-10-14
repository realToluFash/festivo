# Extraction prompt — turning the screens into the design context

> For use **after** Claude Design has produced screens and interactive designs
> from `claude-design-brief.md`. Paste everything below the line into the same
> conversation, so it still has the screens in context.
>
> Why this is a second step rather than the first: a system extracted from real
> screens is grounded in decisions that were actually made, where one specified
> up front is a guess. The risk is the opposite one — tidying on the way out —
> which is what most of this prompt is about.

---

You have built screens and interactive designs. I now need the **design context**
underneath them: the system we will build the product from, extracted from what
you have actually made.

## The one rule that matters

**Document what is there, not what should be there.**

The screens are the truth. If they use five spacing values, the system has five
spacing values — do not round them into a tidy eight-step scale. If a colour
appears once, report it as a one-off rather than folding it into a family. If two
screens do the same thing differently, **say so** instead of quietly picking one
and describing the result as though it were already consistent.

A design context that disagrees with the screens is worse than none at all,
because we will build from the document, ship it, and then find it does not match
the thing you designed. Every value you give me should be traceable to something
you actually drew.

Where you do want to change something — and you probably will, because extracting
a system always exposes accidents — mark it clearly as **a change you are
proposing**, with what it would affect, rather than presenting it as a
description.

## What I need

### 1. Foundations

The real values, as used:

- Colour — every one in use, what it is for, and where it appears. Say which are
  decisions and which are accidents.
- Type — the sizes, weights, line heights and letter spacing actually used, and
  what each step is for. Name the families.
- Spacing, sizing, radii, borders, shadows and elevation — the actual set.
- Anything else the screens rely on that I have not thought to ask for.

Name them by **role** rather than appearance, so a value can change without the
name becoming a lie.

### 2. Components, as built

For every component in the screens:

- What it is for, and what it should never be used for
- Its anatomy and its sizes
- **Every state it is in across the screens**, and — separately — **the states it
  does not have yet**: loading, empty, error, disabled, too-long-content,
  permission-denied. The missing ones are the most useful part of this, because
  they are what gets invented badly during a build.
- Which screens use it, so I can tell a load-bearing component from a one-off

If something appears once and was not really designed as a component, say that
rather than promoting it.

### 3. Behaviour, which is the part that never gets written down

This is the most valuable thing you have and the easiest to lose, because it
lives in the prototype rather than in any picture:

- What opens what, and how it closes
- What happens on press, on drag, on submit, on fail
- Durations and easing, as values
- What is optimistic and what waits for a response
- What happens when something takes 300ms versus three seconds
- What happens when an optimistic action turns out to have failed
- The reduced-motion version of anything that moves

### 4. Layout and how it responds

The actual grid and the actual breakpoints, with **what changes structurally** at
each — not what rescales. If the desk web and the apps diverge, describe them
separately rather than as one responsive continuum.

### 5. Content and language rules

The ones implied by the screens but never stated: sentence or title case,
capitalisation, how numbers, dates, times, money and durations are written, how
long a label may be before something has to give, and what happens to each layout
when every string is 30% longer, which is what Portuguese will do.

### 6. The reasoning

For every decision that could have gone the other way, one sentence on why it
went this way. **A design context without reasons gets overridden by the first
developer who disagrees with it**, and then by the second, differently.

### 7. Coverage

What you have designed, and what you have not, against the fifteen areas of work
in the brief. I need to know which areas have screens, which have only
components, and which have nothing — so I can plan around the gaps rather than
discover them. Do not fill a gap to make the list look complete; name it.

### 8. Where the screens disagree with themselves

Every place two screens solve the same problem differently. For each: what the
difference is, which one should win, and why. This is a decision I want to see
you make explicitly rather than have resolved silently by whichever screen I
happen to build first.

### 9. What you would do differently

Having built it and then taken it apart: what would you change if you started
again, and what in the brief pushed you somewhere you would rather not have
gone? Both are cheap to tell me now and expensive to discover later.

## The form it needs to take

We build the web in **React** and the apps in **React Native**, and everything
will be built twice, so:

- Give the foundations as both **CSS custom properties** and a **plain JavaScript
  object**, with the same names in both.
- Use names that are legal and natural in both — no CSS-only syntax in a name.
- Where a value genuinely has to differ between web and native — shadows,
  elevation, anything relying on CSS the apps do not have — give both and say
  which is which.
- Flag anything in the screens that **cannot be built in React Native**: CSS
  grid, sticky positioning, pseudo-element decoration, text nested inside text,
  anything animating a property other than position or opacity. I would much
  rather hear it now.

## And one page that keeps it honest

An **interactive reference** — every component in every state, reading from the
extracted foundations rather than from hard-coded values, with the states side by
side and the names each one consumes.

The test for it is that it **visibly breaks when a foundation value changes**. If
it does not, it is a picture of a system rather than the system, and it will
drift from the product within a month.

It should also be obvious from looking at it that it and the screens are the same
design. If anything on that page looks subtly unlike the screens it came from,
that is a real difference you have just found — tell me about it rather than
adjusting the page until it matches.

## How to deliver it

In batches, stopping after each, so I can redirect you rather than discover at
the end that we disagreed early. Foundations first, since everything else refers
to them. Then components, then behaviour, then the rest in whatever order suits
what you built.

Where you are unsure whether something is a decision or an accident, say so. That
is more useful to me than a confident answer, and it is usually the exact place
where a developer would have guessed wrong.

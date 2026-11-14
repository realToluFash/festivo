import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { LayersContext, useDeskLayers } from '../layers.ts';
import { routes } from '../routes/index.tsx';
import { type SaveStart } from './templates.ts';
import { SaveTemplateDialog } from './Templates.tsx';

const tested = config();
const SLOW = { timeout: 15000 };
const AT = '/demo/events/evt-wed-4?area=budget&state=';

async function open(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, SLOW);

  return router;
}

function Host({
  start,
  onDismiss,
  onSaved,
}: {
  start: SaveStart;
  onDismiss: () => void;
  onSaved: () => void;
}) {
  const { layers, setHost } = useDeskLayers();

  return (
    <LayersContext value={layers}>
      <div ref={setHost} />
      <SaveTemplateDialog start={start} onDismiss={onDismiss} onSaved={onSaved} />
    </LayersContext>
  );
}

function dialogFor(start: SaveStart) {
  const onDismiss = vi.fn();
  const onSaved = vi.fn();
  render(<Host start={start} onDismiss={onDismiss} onSaved={onSaved} />);

  return { dialog: screen.getByRole('dialog', { name: 'Save as template' }), onDismiss, onSaved };
}

describe('Start from an earlier budget, and Calibration (sc-96)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('groups the same type first and previews the one picked beside it', SLOW, async () => {
    const router = await open('start_from');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Start from an earlier budget' }),
    ).toBeDefined();
    const weddings = screen.getByRole('region', { name: 'Weddings' });
    const picked = within(weddings).getByRole('button', { current: true });
    expect(picked.textContent).toContain('Rafael & Inês’s wedding');
    const pane = screen.getByRole('region', { name: 'Rafael & Inês’s wedding' });
    expect(within(pane).getAllByText('Not priced')).toHaveLength(3);

    fireEvent.click(within(weddings).getByRole('button', { name: /^Wedding, London/u }));
    const template = screen.getByRole('region', { name: 'Wedding, London' });
    expect(within(template).getByText('£64.00 a head')).toBeDefined();

    fireEvent.click(within(template).getByRole('button', { name: 'Start from this budget' }));
    expect(router.state.location.search).toBe('?area=budget');
  });

  it('starts empty in one press', SLOW, async () => {
    const router = await open('start_not_over');

    expect(screen.getByRole('region', { name: 'Other events' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start empty' }));
    expect(router.state.location.search).toBe('?area=budget&state=first_time');
  });

  it('opens what an event that is over came to', SLOW, async () => {
    await open('start_actual');

    const pane = screen.getByRole('region', { name: 'Chidi’s 30th' });
    expect(
      within(pane).getByText(
        'From Chidi’s 30th, where this came to £66 a head against £62 planned.',
      ),
    ).toBeDefined();
  });

  it('shows Calibration per currency, each figure naming its events', SLOW, async () => {
    await open('calibration');

    const pounds = screen.getByRole('region', { name: 'In pounds' });
    expect(within(pounds).getByRole('heading', { name: 'By vendor' })).toBeDefined();
    expect(within(pounds).getByText('£2,600 and €2,200')).toBeDefined();
    expect(within(pounds).getAllByText(/From 2 events, so not a pattern yet\./u)).toHaveLength(3);
    const euros = screen.getByRole('region', { name: 'In euros' });
    expect(within(euros).getByText('€440 over, 4.5%')).toBeDefined();
  });

  it('says from 3 events alone, and when there is nothing to learn from', SLOW, async () => {
    await open('calibration_three');
    expect(screen.getAllByText(/· From 3 events\.$/u)).toHaveLength(3);
    cleanup();

    await open('calibration_empty');
    expect(
      screen.getByText(
        'Nothing to learn from yet. Calibration starts once an event is over and one of its paid quotes covers a single cost.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('region', { name: 'In pounds' })).toBeNull();
  });
});

describe('Save as template, on its own (sc-96)', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('refuses no name at the field before sending, focus on it', () => {
    vi.useFakeTimers();
    const { dialog, onSaved } = dialogFor(null);
    const name = within(dialog).getByRole('textbox', { name: 'Name' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toContain('-error');
    expect(within(dialog).getByText('Enter a name for the template.')).toBeDefined();
    expect(document.activeElement).toBe(name);
    expect(within(dialog).queryByRole('button', { name: 'Saving…' })).toBeNull();
    act(() => vi.runAllTimers());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('opens a deep-linked refusal and clears it once the name is right', () => {
    const { dialog } = dialogFor('long');
    const name = within(dialog).getByRole('textbox', { name: 'Name' });

    expect(within(dialog).getByText('Shorten the name to 80 characters or fewer.')).toBeDefined();
    fireEvent.change(name, { target: { value: 'Wedding at The Landmark' } });
    expect(within(dialog).queryByText('Shorten the name to 80 characters or fewer.')).toBeNull();
    expect(name.getAttribute('aria-invalid')).toBe('false');
    cleanup();

    const blank = dialogFor('blank').dialog;
    expect(within(blank).getByText('Enter a name for the template.')).toBeDefined();
    expect(document.activeElement).toBe(within(blank).getByRole('textbox', { name: 'Name' }));
  });

  it('is refused by the server for a taken name, again on retry, then saves another', () => {
    vi.useFakeTimers();
    const { dialog, onSaved } = dialogFor('taken');
    const name = within(dialog).getByRole('textbox', { name: 'Name' });

    expect((name as HTMLInputElement).value).toBe('wedding, london');
    expect(within(dialog).getByRole('alert').textContent).toBe(
      'A template with that name already exists. Choose another name.',
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('button', { name: 'Saving…' })).toBeDefined();
    act(() => vi.advanceTimersByTime(1000));
    expect(within(dialog).getByRole('alert')).toBeDefined();
    expect(onSaved).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: 'Wedding, Lisbon' } });
    expect(within(dialog).queryByRole('alert')).toBeNull();
    fireEvent.submit(name);
    act(() => vi.advanceTimersByTime(1000));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('says what a template keeps, and Cancel sends nothing', () => {
    const { dialog, onDismiss, onSaved } = dialogFor(null);

    expect(
      within(dialog).getByText(
        'It keeps the 10 costs and their rates, in pounds, never a count. Editing it later changes no event made from it.',
      ),
    ).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

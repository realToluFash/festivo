import { type HostRow } from '@soirely/domain';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HostsSection } from './HostsSection.tsx';

let running: (() => void)[] = [];

function playing(): Animation {
  let finish = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  running.push(finish);

  return { finished, cancel() {} } as unknown as Animation;
}

async function finishAll(): Promise<void> {
  while (running.length > 0) {
    const now = running;
    running = [];
    await act(async () => {
      for (const finish of now) finish();
    });
  }
}

function Hosts({ start }: { start: HostRow[] }) {
  const [rows, setRows] = useState(start);

  return (
    <>
      <HostsSection
        rows={rows}
        errors={{}}
        saved={{ status: 'draft', hosts: [] }}
        busy={false}
        onRows={setRows}
        onLeave={() => {}}
        onSay={() => {}}
      />
      <output data-testid="saved">{rows.map((row) => row.name).join(',')}</output>
    </>
  );
}

describe('Hosted by', () => {
  beforeEach(() => {
    running = [];
    Element.prototype.animate = playing;
    Element.prototype.getAnimations = () => [];
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).animate;
    delete (Element.prototype as Partial<Element>).getAnimations;
  });

  it('removes two hosts clicked in quick succession, and keeps what was typed meanwhile', async () => {
    render(
      <Hosts
        start={[
          { key: 1, name: 'Ada' },
          { key: 2, name: 'Bola' },
          { key: 3, name: 'Chidi' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Ada' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bola' }));
    fireEvent.change(screen.getByDisplayValue('Chidi'), { target: { value: 'Chidi Okafor' } });
    await finishAll();

    expect(screen.getByTestId('saved').textContent).toBe('Chidi Okafor');
    expect(screen.queryByDisplayValue('Ada')).toBeNull();
  });
});

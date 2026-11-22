import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const board = readFileSync(join('src', 'components', 'CalendarBoard.tsx'), 'utf8');

const bodyOf = (name: string) => {
  const from = board.indexOf(`const ${name} = `);
  return board.slice(from, board.indexOf('\n  };', from) + 1);
};

describe('‹ Calendar returns to the month it showed (sc-83008)', () => {
  it('takes no scroll as the reader’s place while another page is over the calendar', () => {
    expect(board).toMatch(/const here = useIsFocused\(\);/u);
    expect(bodyOf('onTop')).toMatch(/if \(!here\) return;\s+weekY\.current = y;/u);
    expect(bodyOf('onAgendaScroll')).toMatch(/if \(!here\) return;\s+agendaY\.current = y;/u);
  });

  it('puts the grid and Agenda back where they were as the calendar is shown again', () => {
    expect(board).toMatch(/const back = here && !wasHere\.current;/u);
    expect(board).toMatch(/scrollToOffset\(\{ offset: weekY\.current, animated: false \}\)/u);
    expect(board).toMatch(/scrollTo\(\{ y: agendaY\.current, animated: false \}\)/u);
  });
});

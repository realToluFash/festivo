import type { Membership } from '@soirely/api-client';
import { deviceCountry } from '@soirely/domain';
import { type RefObject, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { useDeskLayers } from '../layers.ts';
import { CreateWalk } from './CreateWalk.tsx';
import { type Currencies, createOrganisation, freshWalk } from './createWalk.ts';
import { Glyph } from './Glyph.tsx';
import { DeskPage } from './SettingsParts.tsx';
import './SettingsParts.css';

/** sc-390's Create an organisation as the walk (sc-30335): made by the caller as its Owner, with focus back on what opened it once it closes. */
export function CreateOrganisation({
  email,
  onCreated,
  onCancel,
}: {
  email: string;
  onCreated: (created: Membership) => void;
  onCancel: () => void;
}) {
  const { layers, setHost } = useDeskLayers();
  const currencies = useCountryCurrencies();
  // A browser exposes no Region setting, so its languages decide, and nothing named means none.
  const [start] = useState(() =>
    freshWalk({
      country: deviceCountry(navigator.languages),
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  );

  useEffect(() => {
    const opener = document.activeElement;

    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  return (
    <DeskPage layers={layers}>
      <CreateWalk
        start={start}
        email={email}
        currencies={currencies}
        create={(walk) => createOrganisation((made) => api.createOrganisation(made), walk)}
        onClose={onCancel}
        onCreated={onCreated}
      />
      <div ref={setHost} className="desk-layers" />
    </DeskPage>
  );
}

/** No organisation's way to start one: the dashed tile, and Start organisation, which opens the walk. */
export function StartYourOwn({
  button,
  onStart,
}: {
  button?: RefObject<HTMLButtonElement | null>;
  onStart: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <section className="cw-start" aria-labelledby={`${id}-start`}>
      <span className="cw-start-tile" aria-hidden="true">
        <Glyph name="plus" size={20} weight={2.4} />
      </span>
      <h2 id={`${id}-start`}>{t('noOrganisation.startTitle')}</h2>
      <p>{t('noOrganisation.startBody')}</p>
      <button ref={button} type="button" className="cw-start-button" onClick={onStart}>
        {t('noOrganisation.start')}
      </button>
    </section>
  );
}

let currenciesRead: Currencies | null = null;
let currenciesAsked: Promise<Currencies> | null = null;

/** The currency each country founds with, read once the walk first opens and kept: it changes only with the API. A read that failed is asked again the next time the walk opens. */
function useCountryCurrencies(): Currencies | null {
  const [currencies, setCurrencies] = useState(currenciesRead);

  useEffect(() => {
    if (currenciesRead != null) return;
    currenciesAsked ??= api.countryCurrencies().then(
      (read) => {
        currenciesRead = read;
        return read;
      },
      (failure: unknown) => {
        currenciesAsked = null;
        throw failure;
      },
    );
    let live = true;
    currenciesAsked.then(
      (read) => {
        if (live) setCurrencies(read);
      },
      () => {},
    );

    return () => {
      live = false;
    };
  }, []);

  return currencies ?? currenciesRead;
}

import i18next from 'i18next';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { pageTitle, usePageTitle } from '../pageTitle.ts';
import { NewHere, PageFooter } from './BoardPage.tsx';
import {
  type Block,
  type LegalDoc,
  type LegalLang,
  legalWords,
  SAMPLE_MARK,
  documentFor,
  legalLang,
  legalPath,
  sampleLang,
  updatedLine,
} from './legal.ts';
import './legal.css';

/** /terms and /privacy (sc-28982): one page in the signed-out frame, the document's own title, its date and its text. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const [params] = useSearchParams();
  const state = params.get('state') ?? '';

  return <LegalBoard key={`${doc}:${state}`} doc={doc} state={state} />;
}

function LegalBoard({ doc, state }: { doc: LegalDoc; state: string }) {
  const [lang, setLang] = useState<LegalLang>(state === 'fr' ? 'fr' : 'en');
  const shown = sampleLang(lang);
  const text = documentFor(doc, lang);
  const words = legalWords(lang);
  // The footer's own words (the language button's menu) in the page's language, without changing the demo's.
  const local = useMemo(() => i18next.cloneInstance({ lng: lang }), [lang]);
  usePageTitle(pageTitle(i18next.getFixedT(lang), [doc === 'terms' ? words.terms : words.privacy]));

  useEffect(() => {
    if (state === 'middle') document.getElementById('legal-middle')?.scrollIntoView?.();
  }, [state]);

  return (
    <div className="demo-page demo-legal" lang={shown}>
      <header className="demo-page-header">
        <Brand lockup />
        {/* Signed in, the same frame: no sign-in, no app header, and no way in to offer. */}
        {state !== 'signed-in' && (
          <div className="demo-page-new">
            <NewHere />
          </div>
        )}
      </header>
      <main id="content" className="demo-page-main">
        <article className="legal-column">
          <div className="legal-heading">
            <h1>{text.title}</h1>
            <p className="legal-updated">{updatedLine(lang)}</p>
          </div>
          <aside className="legal-sample" lang="en" aria-label="Demo">
            <p className="legal-sample-title">{SAMPLE_MARK[doc]}.</p>
            <p>
              It shows how a long document is set on this page. Soirely’s own text replaces every
              word.
              {lang !== shown && ' The demo writes the sample in English and French only.'}
            </p>
          </aside>
          <div className="legal-body">
            {text.blocks.map((block, index) => (
              <Part key={index} block={block} lang={lang} />
            ))}
          </div>
        </article>
      </main>
      <I18nextProvider i18n={local}>
        <PageFooter language={lang} onChoose={(code) => setLang(legalLang(code))} shown={lang} />
      </I18nextProvider>
      <div className="demo-way-in">
        <Link className="link-button" to="/demo">
          All states in the demo
        </Link>
      </div>
    </div>
  );
}

function Part({ block, lang }: { block: Block; lang: LegalLang }) {
  switch (block.kind) {
    case 'h2':
      return <h2 id={block.middle ? 'legal-middle' : undefined}>{block.words}</h2>;
    case 'h3':
      return <h3>{block.words}</h3>;
    case 'ul':
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case 'p':
      return (
        <p>
          {block.runs.map((run, index) =>
            typeof run === 'string' ? (
              <Fragment key={index}>{run}</Fragment>
            ) : (
              <Link key={index} className="legal-link" to={legalPath(run.to, lang)}>
                {run.words}
              </Link>
            ),
          )}
        </p>
      );
  }
}

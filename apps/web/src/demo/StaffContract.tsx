import { useEffect, useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Choices, Field } from '../components/SettingsParts.tsx';
import { ENTERPRISE, money } from './billing.ts';
import {
  BLANK_FORM,
  CONTRACT_WORDS as W,
  type ContractForm,
  FILLED_FORM,
  type FormErrors,
  type FormField,
  INVALID_FORM,
  PAYMENT_TERMS,
  type StaffState,
  TERMS_NAMES,
  checkContract,
  poCounter,
  staffStateOf,
} from './contract.ts';
import './billing.css';
import './contract.css';

const FORMS: Record<StaffState, ContractForm> = {
  blank: BLANK_FORM,
  filled: FILLED_FORM,
  invalid: INVALID_FORM,
  refused: FILLED_FORM,
};

/** sc-613: Soirely staff put an organisation on Enterprise by contract (StaffContract-Desktop.dc.html), as a page of its own until epic 39's console has a demo. */
export function StaffContract() {
  const [params] = useSearchParams();
  const state = staffStateOf(params.get('state'));

  return <StaffForm key={state} state={state} />;
}

type Sent = 'none' | 'asking' | 'refused' | 'saved';

function StaffForm({ state }: { state: StaffState }) {
  const [form, setForm] = useState<ContractForm>(FORMS[state]);
  const [pressed, setPressed] = useState(state === 'invalid');
  const [errors, setErrors] = useState<FormErrors>(() =>
    state === 'invalid' ? checkContract(INVALID_FORM) : {},
  );
  const [focusFirst, setFocusFirst] = useState(0);
  const [sent, setSent] = useState<Sent>(state === 'refused' ? 'refused' : 'none');
  const listPrice = money(ENTERPRISE.price * 12, ENTERPRISE.currency, 'en-GB');

  useEffect(() => {
    if (focusFirst === 0) return;
    document.querySelector<HTMLInputElement>('.ct-staff [aria-invalid="true"]')?.focus();
  }, [focusFirst]);

  const change = (next: ContractForm) => {
    setForm(next);
    setSent((now) => (now === 'saved' ? now : 'none'));
    if (!pressed) return;
    const now = checkContract(next);
    setErrors((shown) => {
      const kept: FormErrors = {};
      for (const key of Object.keys(now) as FormField[]) {
        const words = now[key];
        if (words != null && (shown[key] != null || key === 'discountReason')) kept[key] = words;
      }

      return kept;
    });
  };

  const set = (field: Exclude<keyof ContractForm, 'contacts' | 'terms'>) => (value: string) =>
    change({ ...form, [field]: value });

  const save = () => {
    const found = checkContract(form);
    setPressed(true);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFocusFirst((n) => n + 1);
      return;
    }
    setSent('asking');
  };

  const contact = (index: number) => (value: string) =>
    change({ ...form, contacts: form.contacts.map((one, at) => (at === index ? value : one)) });

  return (
    <div className="ct-staff-page">
      <header className="ct-staff-header">
        <p className="ct-strong">Soirely Support</p>
        <p className="desk-line">Staff only · Ana Lima, billing support</p>
      </header>
      <main className="ct-staff" id="content">
        <h1 className="ct-staff-title">Put Ire Events on Enterprise</h1>
        <dl className="ct-facts">
          <div className="ct-fact">
            <dt>Billing account</dt>
            <dd>Ire Events · US dollars (USD)</dd>
          </div>
          <div className="ct-fact">
            <dt>Catalogue</dt>
            <dd>Enterprise, the version in force today</dd>
          </div>
          <div className="ct-fact">
            <dt>Source</dt>
            <dd>Invoice, issued by Paddle</dd>
          </div>
        </dl>

        {sent === 'refused' && (
          <div className="ct-refused" role="alert">
            <Glyph name="alert" size={18} weight={2.2} />
            <p>{W.paddleRefused}</p>
          </div>
        )}
        {sent === 'saved' && (
          <div className="sw-notice is-done" role="status">
            <span className="sw-notice-mark" aria-hidden="true">
              <Glyph name="tick" size={15} weight={3} />
            </span>
            <p className="sw-notice-words">{W.saved}</p>
          </div>
        )}

        <form
          className="ct-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="ct-pair">
            <DateField
              label="Term starts"
              value={form.start}
              onChange={set('start')}
              error={errors.start ?? null}
            />
            <DateField
              label="Term ends"
              value={form.end}
              onChange={set('end')}
              error={errors.end ?? null}
            />
          </div>
          <Field
            label="Price for the term, in USD"
            value={form.price}
            onChange={set('price')}
            inputMode="numeric"
            help={`List price: ${listPrice} a year.`}
            error={errors.price ?? null}
          />
          <div className="ct-pair">
            <Field
              label="Discount, %"
              value={form.discount}
              onChange={set('discount')}
              inputMode="numeric"
              help="Above 0 and below 100. Leave it empty for no discount."
              action={<span className="demo-optional">Optional</span>}
              error={errors.discount ?? null}
            />
            <Field
              label="Reason for the discount"
              value={form.discountReason}
              onChange={set('discountReason')}
              help="Needed only with a discount."
              action={<span className="demo-optional">Optional</span>}
              error={errors.discountReason ?? null}
            />
          </div>
          <Choices
            legend={W.paymentTerms}
            choices={PAYMENT_TERMS.map((terms) => ({ id: terms, name: TERMS_NAMES[terms] }))}
            picked={form.terms}
            onPick={(terms) =>
              change({ ...form, terms: PAYMENT_TERMS.find((one) => one === terms) ?? 'net_30' })
            }
          />
          <PoField
            value={form.purchaseOrder}
            onChange={set('purchaseOrder')}
            error={errors.purchaseOrder ?? null}
          />
          <fieldset className="ct-contacts">
            <legend className="desk-legend">{W.contacts}</legend>
            {form.contacts.map((one, index) => (
              <div key={index} className="ct-contact">
                <Field
                  label={`Email address ${String(index + 1)}`}
                  value={one}
                  onChange={contact(index)}
                  inputMode="email"
                  error={errors[`contact-${String(index)}`] ?? null}
                />
                {index > 0 && (
                  <button
                    type="button"
                    className="desk-text"
                    aria-label={`Remove email address ${String(index + 1)}`}
                    onClick={() =>
                      change({ ...form, contacts: form.contacts.filter((_, at) => at !== index) })
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="desk-text ct-add"
              onClick={() => change({ ...form, contacts: [...form.contacts, ''] })}
            >
              Add another contact
            </button>
          </fieldset>
          <Field
            label="Reason for this change"
            value={form.reason}
            onChange={set('reason')}
            help="It goes in the audit log with your name."
            error={errors.reason ?? null}
          />
          <div className="ct-actions">
            <Link className="desk-text" to="/demo">
              Cancel
            </Link>
            <button type="submit" className="button button-primary">
              Save the contract
            </button>
          </div>
        </form>

        {sent === 'asking' && (
          <div className="bl-demo-only">
            <p>
              Stand-ins for Paddle’s answer, in the demo only. Nothing is saved until it accepts.
            </p>
            <button type="button" className="desk-text" onClick={() => setSent('saved')}>
              Paddle accepts the invoice
            </button>
            <button type="button" className="desk-text" onClick={() => setSent('refused')}>
              Paddle refuses it
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

/** The kit's Field with the PO counter tied to the input, so it is read again on returning to the field (GOV.UK character count). */
function PoField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}) {
  const id = useId();
  const counter = poCounter(value);
  const told = [
    `${id}-help`,
    counter == null ? null : `${id}-count`,
    error == null ? null : `${id}-error`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <div className="desk-label-row">
        <label htmlFor={id} className="desk-label">
          Purchase order number
        </label>
        <span className="demo-optional">Optional</span>
      </div>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type="text"
          value={value}
          spellCheck={false}
          aria-invalid={error != null}
          aria-describedby={told}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <p id={`${id}-help`} className="desk-help">
        Up to 100 characters.
      </p>
      <p
        id={`${id}-count`}
        className={counter?.over === true ? 'ct-counter is-over' : 'ct-counter'}
        aria-live="polite"
      >
        {counter?.words}
      </p>
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}) {
  const id = useId();

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type="date"
          value={value}
          aria-invalid={error != null}
          aria-describedby={error == null ? undefined : `${id}-error`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
    </div>
  );
}

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ContactIcon } from './ContactIcon';
import { phoneCountries } from '../data/phoneCountries';
import { PERSONAL_DATA_CONSENT_VERSION } from '../data/privacy';
import { detectDeviceProfile } from '../services/deviceProfile';
import {
  LEAD_SUCCESS_STORAGE_KEY, submitLead, validateLead,
  type ContactMethod, type LeadErrors, type LeadInput, type PackageName,
} from '../services/lead';

export interface LeadFormProps {
  variant?: 'modal' | 'inline';
  packageName?: PackageName;
  basePath?: string;
  onSuccess?: () => void;
}

const methods: { value: ContactMethod; label: string }[] = [
  { value: 'phone', label: 'Телефон' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'max_messenger', label: 'Max' },
];
const packages: PackageName[] = ['Минимальный', 'Базовый', 'Полный'];
const packageFormIds: Record<PackageName, string> = {
  'Минимальный': 'modal-package-minimal',
  'Базовый': 'modal-package-base',
  'Полный': 'modal-package-full',
};

function createSubmissionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `lead-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

// During prerender Vite's import.meta.env is unavailable, while the production
// browser bundle receives VITE_LEAD_ENDPOINT from Vite. Read the Node
// environment as a fallback so both renders produce identical markup.
const configuredLeadEndpoint = import.meta.env?.VITE_LEAD_ENDPOINT
  ?? (typeof process !== 'undefined' ? process.env.VITE_LEAD_ENDPOINT : undefined);

/** Accepts pasted +7 / 8 numbers as well as a national number. */
function nationalDigits(value: string, prefix: string, mask?: string): string {
  let digits = value.replace(/\D/g, '');
  if (prefix === '7' && digits.length === 11 && /^[78]/.test(digits)) digits = digits.slice(1);
  else if (value.trim().startsWith('+') && digits.startsWith(prefix)) digits = digits.slice(prefix.length);
  return digits.slice(0, Math.min(mask ? (mask.match(/0/g)?.length ?? 15) : 15, 15 - prefix.length));
}

function formatNational(value: string, prefix: string, mask: string): string {
  const digits = nationalDigits(value, prefix, mask);
  if (!digits) return '';
  let cursor = 0;
  let result = '';
  for (const character of mask) {
    if (cursor >= digits.length) break;
    result += character === '0' ? digits[cursor++] : character;
  }
  return result;
}

export function LeadForm({ variant = 'modal', packageName, basePath = './', onSuccess }: LeadFormProps) {
  const reactId = useId();
  // The one inline form is hydrated as its own island after the page is prerendered.
  const id = variant === 'inline' ? 'lead-inline' : `lead-${reactId.replace(/:/g, '')}`;
  const inline = variant === 'inline';
  const [name, setName] = useState('');
  const [method, setMethod] = useState<ContactMethod>('phone');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('RU');
  const [consent, setConsent] = useState(false);
  const [consentAcceptedAt, setConsentAcceptedAt] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<PackageName>(packageName ?? 'Минимальный');
  const [errors, setErrors] = useState<LeadErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const submissionIdRef = useRef('');
  const controllerRef = useRef<AbortController | null>(null);
  const countryData = phoneCountries.find((item) => item.iso === country)!;
  const prefix = countryData.dial.replace(/\D/g, '');
  const contact = phone ? `+${prefix}${nationalDigits(phone, prefix, countryData.mask)}` : '';
  const remoteDeliveryEnabled = Boolean(configuredLeadEndpoint?.trim());

  useEffect(() => { if (packageName) setSelectedPackage(packageName); }, [packageName]);
  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (!inline || !formRef.current) return;
    const form = formRef.current;
    const section = form.closest<HTMLElement>('[data-section="inquiry"]');
    if (!section) return;
    const updateHeight = () => {
      const zoom = form.getBoundingClientRect().width / (parseFloat(getComputedStyle(form).width) || 1);
      const extra = [...form.querySelectorAll<HTMLElement>('.lead-field-error,.lead-error-summary')].reduce((sum, element) => {
        const style = getComputedStyle(element);
        return sum + element.getBoundingClientRect().height / zoom + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
      }, 0);
      section.style.setProperty('--form-growth', `${Math.ceil(extra)}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(form);
    return () => observer.disconnect();
  }, [inline, errors, submitError]);

  const formId = inline ? 'homepage-inline' : packageName ? packageFormIds[selectedPackage] : 'modal-general';
  const getLead = (submissionId: string): LeadInput => {
    const deviceProfile = detectDeviceProfile();
    return {
      name, contact, contactMethod: method, consent, source: variant,
      consentAcceptedAt,
      consentVersion: PERSONAL_DATA_CONSENT_VERSION,
      submissionId,
      formId,
      phoneCountry: country,
      ...deviceProfile,
      ...(packageName ? { packageName: selectedPackage } : {}),
    };
  };

  function updateContact(value: string) {
    let destination = countryData;
    const pastedDigits = value.replace(/\D/g, '');
    if (value.trim().startsWith('+') && !pastedDigits.startsWith(prefix)) {
      // Longest calling-code match also handles territories such as +1 (268).
      destination = phoneCountries
        .filter((item) => pastedDigits.startsWith(item.dial.replace(/\D/g, '')))
        .sort((a, b) => b.dial.replace(/\D/g, '').length - a.dial.replace(/\D/g, '').length)[0] ?? countryData;
      setCountry(destination.iso);
    }
    setPhone(formatNational(value, destination.dial.replace(/\D/g, ''), destination.mask));
    setErrors((previous) => ({ ...previous, contact: undefined }));
    setSubmitError('');
  }

  function focusField(field: keyof LeadErrors) {
    const element = formRef.current?.elements.namedItem(field);
    if (element instanceof HTMLElement) {
      element.focus({preventScroll:inline});
      if(inline)requestAnimationFrame(()=>element.scrollIntoView({block:'center',behavior:'smooth'}));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const submissionId = submissionIdRef.current || createSubmissionId();
    const lead = getLead(submissionId);
    const validation = validateLead(lead);
    setErrors(validation);
    setSubmitError('');
    const firstError = (['name', 'contact', 'consent'] as const).find((field) => validation[field]);
    if (firstError) { focusField(firstError); return; }
    submissionIdRef.current = submissionId;
    submittingRef.current = true;
    setPending(true);
    controllerRef.current = new AbortController();
    try {
      const result = await submitLead(lead, { signal: controllerRef.current.signal });
      try { sessionStorage.setItem(LEAD_SUCCESS_STORAGE_KEY, JSON.stringify({ status: 'success', mode: result.mode })); } catch { /* Private browsing must not break the form. */ }
      setSubmitted(true);
      if (onSuccess) onSuccess();
      else window.location.assign(`${basePath}thankyou/`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setSubmitError('Не удалось отправить заявку. Попробуйте ещё раз.');
    } finally {
      submittingRef.current = false;
      if (!controllerRef.current?.signal.aborted) setPending(false);
    }
  }

  function fieldError(field: keyof LeadErrors) {
    return errors[field] ? <p className="lead-field-error" id={`${id}-${field}-error`}>{errors[field]}</p> : null;
  }

  const phoneControl = (
    <div className={`lead-phone${errors.contact ? ' lead-control-error' : ''}`}>
      <span className="lead-country-control">
        <span className={`lead-country-flag${country === 'RU' ? ' lead-country-flag--ru' : ''}`} aria-hidden="true">
          {country !== 'RU' ? country.toUpperCase().replace(/./g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))) : ''}
        </span>
        <span className="lead-country-chevron" aria-hidden="true" />
        <select aria-label="Код страны" value={country} disabled={pending} onChange={(event) => {
          const nextCountry = phoneCountries.find((item) => item.iso === event.target.value)!;
          const currentDigits = nationalDigits(phone, prefix, countryData.mask);
          setCountry(nextCountry.iso);
          setPhone(formatNational(currentDigits, nextCountry.dial.replace(/\D/g, ''), nextCountry.mask));
          setErrors((previous) => ({ ...previous, contact: undefined }));
        }}>
          {phoneCountries.map((item) => <option key={item.iso} value={item.iso}>{item.name} {item.dial}</option>)}
        </select>
      </span>
      <span className="lead-phone-prefix" aria-hidden="true">{countryData.dial}</span>
      <input id={`${id}-contact`} name="contact" type="tel" autoComplete="tel-national" inputMode="tel"
        value={phone} onChange={(event) => updateContact(event.target.value)}
        placeholder={countryData.mask}
        aria-label={inline ? undefined : 'Телефон'} required disabled={pending}
        aria-invalid={Boolean(errors.contact)} aria-describedby={errors.contact ? `${id}-contact-error` : undefined} />
    </div>
  );

  const errorMessages = Array.from(new Set(Object.values(errors).filter(Boolean)));
  return (
    <div className={`lead-form-card lead-form-card--${variant}`}>
      <form ref={formRef} className={`lead-form lead-form--${variant}`} onSubmit={handleSubmit} noValidate aria-label="Заявка на фотосессию" aria-busy={pending} aria-describedby={remoteDeliveryEnabled ? undefined : `${id}-demo`}>
        {!remoteDeliveryEnabled && <p className="secondary-sr-only" id={`${id}-demo`}>Локальная демонстрационная форма. Заявка не передаётся фотографу и контактные данные не сохраняются.</p>}
        <div className="lead-form-fields">
          <div className="lead-field lead-field--name">
            <label className="lead-label" htmlFor={`${id}-name`}>Имя</label>
            <input className={`lead-input${errors.name ? ' lead-control-error' : ''}`} id={`${id}-name`} name="name" type="text" autoComplete="name" maxLength={100}
              placeholder="Как к вам обращаться?" value={name} onChange={(event) => { setName(event.target.value); setErrors((previous) => ({ ...previous, name: undefined })); setSubmitError(''); }}
              required disabled={pending} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${id}-name-error` : undefined} />
            {fieldError('name')}
          </div>

          {inline && <div className="lead-field lead-field--phone"><label className="lead-label" htmlFor={`${id}-contact`}>Телефон</label>{phoneControl}{fieldError('contact')}</div>}

          <div className="lead-field lead-field--connection">
            <fieldset className="lead-methods"><legend className="lead-label">Как вам удобно связаться?</legend>
              <div className="lead-method-options">{methods.map((item) => <label className={`lead-method${method === item.value ? ' lead-method--selected' : ''}`} key={item.value}>
                <input type="radio" name="contactMethod" value={item.value} checked={method === item.value} disabled={pending} onChange={() => { setMethod(item.value); setErrors((previous) => ({ ...previous, contact: undefined })); setSubmitError(''); }} />
                <ContactIcon type={item.value} className={`lead-method-icon lead-method-icon--${item.value}`} /><span>{item.label}</span>
              </label>)}</div>
            </fieldset>
            {!inline && <>
              {phoneControl}
              {fieldError('contact')}
            </>}
          </div>

          {packageName && <div className="lead-field lead-field--package"><label className="lead-label" htmlFor={`${id}-package`}>Выбранный пакет</label>
            <div className="lead-select-wrap"><select className="lead-select" id={`${id}-package`} value={selectedPackage} disabled={pending} onChange={(event) => setSelectedPackage(event.target.value as PackageName)}>
              {packages.map((item) => <option key={item}>{item}</option>)}
            </select></div>
          </div>}

          <div className="lead-field lead-field--consent">
            <label className="lead-consent"><input name="consent" type="checkbox" checked={consent} onChange={(event) => {
              const checked = event.target.checked;
              setConsent(checked);
              setConsentAcceptedAt(checked ? new Date().toISOString() : '');
              if (!checked) submissionIdRef.current = '';
              setErrors((previous) => ({ ...previous, consent: undefined }));
              setSubmitError('');
            }}
              required disabled={pending} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? `${id}-consent-error` : undefined} />
              <span>Я ознакомился(лась) с <a href={`${basePath}privacy/`} target="_blank" rel="noopener noreferrer">Политикой в отношении обработки персональных данных</a> и даю отдельное <a href={`${basePath}consent/`} target="_blank" rel="noopener noreferrer">Согласие на обработку персональных данных</a>.</span>
            </label>{fieldError('consent')}
          </div>
        </div>

        {(errorMessages.length > 0 || submitError) && <div className="lead-error-summary" role="alert" aria-label="Ошибки при заполнении формы">
          {submitError ? <p>{submitError}</p> : <><p>Пожалуйста, заполните все обязательные поля</p>{errorMessages.filter((message) => message !== 'Обязательное поле').map((message) => <p key={message}>{message}</p>)}</>}
        </div>}
        <button className="lead-submit" type="submit" disabled={pending || !consent}>
          {pending ? <><span className="lead-spinner" aria-hidden="true" />Отправка…</> : inline ? 'ОТПРАВИТЬ И ПОЛУЧИТЬ ЧЕК ЛИСТ' : 'Заказать фотосессию'}
        </button>
        <span className="secondary-sr-only" role="status">{submitted ? (remoteDeliveryEnabled ? 'Заявка отправлена фотографу.' : 'Демонстрационная заявка обработана. Контактные данные не передавались.') : pending ? 'Обработка формы' : ''}</span>
      </form>
      {!inline && <p className="lead-gift">Оставьте свои контакты и получите подарок<br />Чек-лист «Идеальный бизнес-портрет»</p>}
    </div>
  );
}

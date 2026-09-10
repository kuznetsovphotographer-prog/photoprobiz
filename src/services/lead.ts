import { phoneCountries } from '../data/phoneCountries';

export type ContactMethod = 'phone' | 'telegram' | 'whatsapp' | 'max_messenger';
export type PackageName = 'Минимальный' | 'Базовый' | 'Полный';

export interface LeadInput {
  name: string;
  contact: string;
  contactMethod: ContactMethod;
  consent: boolean;
  packageName?: PackageName;
  source: 'modal' | 'inline';
  phoneCountry?: string;
}

export type LeadErrors = Partial<Record<'name' | 'contact' | 'consent', string>>;
export interface LeadResult { status: 'success'; mode: 'mock' | 'remote' }
export type LeadAdapter = (lead: LeadInput, signal?: AbortSignal) => Promise<LeadResult>;
export interface SubmitLeadOptions { adapter?: LeadAdapter; signal?: AbortSignal }

/** The marker contains no name, phone number, or other contact information. */
export const LEAD_SUCCESS_STORAGE_KEY = 'photoprobiz:lead-success';

const phoneDigits = (value: string) => value.replace(/\D/g, '');

export function validateLead(lead: LeadInput): LeadErrors {
  const errors: LeadErrors = {};
  const name = lead.name.trim();
  const contact = lead.contact.trim();
  if (!name) errors.name = 'Обязательное поле';
  else if (!/[\p{L}]/u.test(name) || /[\d<>]/u.test(name) || name.length > 100) {
    errors.name = 'Укажите, пожалуйста, имя';
  }

  if (!contact) errors.contact = 'Обязательное поле';
  else {
    const length = phoneDigits(contact).length;
    const country = phoneCountries.find((item) => item.iso === lead.phoneCountry);
    const expectedLength = country ? phoneDigits(country.dial).length + (country.mask.match(/0/g)?.length ?? 0) : contact.startsWith('+7') ? 11 : 10;
    if (!/^\+?[\d\s().-]+$/.test(contact)) errors.contact = 'Укажите номер телефона';
    else if (length < Math.min(expectedLength, 15)) errors.contact = 'Слишком короткое значение';
    else if (length > 15) errors.contact = 'Проверьте номер телефона';
  }
  if (!lead.consent) errors.consent = 'Обязательное поле';
  return errors;
}

/** Default local adapter: asynchronous UI rehearsal, no network or persistence. */
export const mockLeadAdapter: LeadAdapter = (_lead, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
  const onAbort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve({ status: 'success', mode: 'mock' });
  }, 550);
  signal?.addEventListener('abort', onAbort, { once: true });
});

/** Opt-in future transport. Nothing calls this unless VITE_LEAD_ENDPOINT is configured. */
export function createHttpLeadAdapter(endpoint: string, timeoutMs = 12000): LeadAdapter {
  return async (lead, signal) => {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener('abort', abortFromCaller, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException('Timed out', 'TimeoutError'));
    }, timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Не удалось отправить заявку. Попробуйте ещё раз.');
      const result = await response.json();
      if (result?.ok !== true) throw new Error('Сервер не подтвердил отправку заявки. Попробуйте ещё раз.');
      return { status: 'success', mode: 'remote' };
    } catch (error) {
      if (timedOut) throw new Error('Сервер долго не отвечает. Проверьте соединение и попробуйте ещё раз.');
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  };
}

/** Tests can inject a rejecting adapter without exposing an error switch to visitors. */
export async function submitLead(lead: LeadInput, options: SubmitLeadOptions = {}): Promise<LeadResult> {
  if (Object.keys(validateLead(lead)).length) throw new Error('Пожалуйста, проверьте поля формы.');
  const endpoint = import.meta.env?.VITE_LEAD_ENDPOINT?.trim();
  const adapter = options.adapter ?? (endpoint ? createHttpLeadAdapter(endpoint) : mockLeadAdapter);
  return adapter({ ...lead, name: lead.name.trim(), contact: lead.contact.trim() }, options.signal);
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHttpLeadAdapter, mockLeadAdapter, submitLead, validateLead, type LeadInput } from './lead';

const validLead: LeadInput = {
  name: 'Тест', contact: '+79991234567', contactMethod: 'phone', consent: true, source: 'modal',
};

test('empty fields and unchecked consent return field-specific errors', () => {
  assert.deepEqual(validateLead({ ...validLead, name: '', contact: '', consent: false }), {
    name: 'Обязательное поле', contact: 'Обязательное поле', consent: 'Обязательное поле',
  });
});

test('a short Russian number cannot pass just because the country prefix adds a digit', () => {
  assert.equal(validateLead({ ...validLead, contact: '+7999123456' }).contact, 'Слишком короткое значение');
  assert.deepEqual(validateLead(validLead), {});
});

test('every contact method accepts only a complete phone number', () => {
  for (const contactMethod of ['phone', 'telegram', 'whatsapp', 'max_messenger'] as const) {
    assert.deepEqual(validateLead({ ...validLead, contactMethod }), {});
  }
  assert.ok(validateLead({ ...validLead, contactMethod: 'telegram', contact: '@sample_user' }).contact);
  assert.ok(validateLead({ ...validLead, contactMethod: 'max_messenger', contact: 'https://max.ru/u/sample' }).contact);
});

test('the inline form always validates the phone field even when Telegram is selected', () => {
  assert.ok(validateLead({ ...validLead, source: 'inline', contactMethod: 'telegram', contact: '@sample_user' }).contact);
  assert.deepEqual(validateLead({ ...validLead, source: 'inline', contactMethod: 'telegram' }), {});
});

test('a selected international country uses its own complete phone mask', () => {
  assert.deepEqual(validateLead({ ...validLead, phoneCountry: 'BY', contact: '+375291234567' }), {});
  assert.equal(validateLead({ ...validLead, phoneCountry: 'BY', contact: '+37529123456' }).contact, 'Слишком короткое значение');
  assert.deepEqual(validateLead({ ...validLead, phoneCountry: 'US', contact: '+12025550123' }), {});
});

test('mock success is asynchronous and makes no network requests', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error('Unexpected network request'); }) as typeof fetch;
  try {
    let resolved = false;
    const pending = submitLead(validLead).then((result) => { resolved = true; return result; });
    assert.equal(resolved, false);
    assert.deepEqual(await pending, { status: 'success', mode: 'mock' });
  } finally { globalThis.fetch = originalFetch; }
});

test('an injected transport failure remains an error and cannot become success', async () => {
  await assert.rejects(submitLead(validLead, { adapter: async () => { throw new Error('Test transport failure'); } }), /Test transport failure/);
});

test('unmount cancellation aborts the pending mock request', async () => {
  const controller = new AbortController();
  const pending = mockLeadAdapter(validLead, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('HTTP delivery has a bounded timeout instead of waiting forever', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  })) as typeof fetch;
  try {
    await assert.rejects(createHttpLeadAdapter('https://example.test/lead', 5)(validLead), /долго не отвечает/);
  } finally { globalThis.fetch = originalFetch; }
});

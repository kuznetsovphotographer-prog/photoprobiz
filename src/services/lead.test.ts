import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHttpLeadAdapter, mockLeadAdapter, submitLead, validateLead, type LeadInput } from './lead';
import { classifyDevice } from './deviceProfile';

const validLead: LeadInput = {
  name: 'Тест', contact: '+79991234567', contactMethod: 'phone', consent: true, source: 'modal',
  consentAcceptedAt: '2026-09-12T10:00:00.000Z', consentVersion: '2026-09-12-2',
  submissionId: '019a1234-5678-7000-8000-123456789abc', formId: 'modal-general',
  deviceType: 'computer', osFamily: 'windows',
};

test('empty fields and unchecked consent return field-specific errors', () => {
  assert.deepEqual(validateLead({ ...validLead, name: '', contact: '', consent: false }), {
    name: 'Обязательное поле', contact: 'Обязательное поле', consent: 'Обязательное поле',
  });
});

test('consent evidence is required and must use the current document version', () => {
  for (const patch of [
    { consentAcceptedAt: '' },
    { consentAcceptedAt: 'not-a-date' },
    { consentVersion: 'legacy' },
    { submissionId: '' },
    { formId: '' },
  ]) assert.equal(validateLead({ ...validLead, ...patch }).consent, 'Обязательное поле');
});

test('only supported coarse device and operating-system values can be sent', () => {
  assert.deepEqual(validateLead(validLead), {});
  assert.ok(validateLead({ ...validLead, deviceType: 'watch' as LeadInput['deviceType'] }).consent);
  assert.ok(validateLead({ ...validLead, osFamily: 'windows-11' as LeadInput['osFamily'] }).consent);
});

test('device classification covers desktop, phone, tablet and iPad desktop mode', () => {
  assert.deepEqual(classifyDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' }), { deviceType: 'computer', osFamily: 'windows' });
  assert.deepEqual(classifyDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel) AppleWebKit Mobile', platform: 'Linux armv8l' }), { deviceType: 'phone', osFamily: 'android' });
  assert.deepEqual(classifyDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Tablet)', platform: 'Linux armv8l' }), { deviceType: 'tablet', osFamily: 'android' });
  assert.deepEqual(classifyDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 }), { deviceType: 'tablet', osFamily: 'ipados' });
  assert.deepEqual(classifyDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile', platform: 'iPhone' }), { deviceType: 'phone', osFamily: 'ios' });
  assert.deepEqual(classifyDevice(undefined), { deviceType: 'unknown', osFamily: 'unknown' });
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

test('HTTP delivery requires explicit confirmation, not just status 200', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const body of [{}, { ok: false }, [{ status: 200 }]]) {
      globalThis.fetch = async () => new Response(JSON.stringify(body));
      await assert.rejects(createHttpLeadAdapter('https://example.test/lead')(validLead), /не подтвердил/);
    }
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }));
    assert.deepEqual(await createHttpLeadAdapter('https://example.test/lead')(validLead), { status: 'success', mode: 'remote' });
  } finally { globalThis.fetch = originalFetch; }
});

test('HTTP delivery preserves the complete consent evidence', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_input, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), validLead);
      return new Response(JSON.stringify({ ok: true }));
    };
    await createHttpLeadAdapter('https://example.test/lead')(validLead);
  } finally { globalThis.fetch = originalFetch; }
});

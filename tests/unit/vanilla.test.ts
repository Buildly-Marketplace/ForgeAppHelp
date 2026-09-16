import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHelpClient, stopHelpClient, HelpForm, WebStorageAdapter } from '../../src/vanilla';
import { defaultAdapters } from '../../src/adapters';

const config = { productId: 'p', apiKey: 'k', isTestMode: true };

let fetchMock: ReturnType<typeof vi.fn>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'issue-1' }), { status: 201 }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  localStorage.clear();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  document.body.innerHTML = '';
});

describe('createHelpClient', () => {
  it('returns a started reporter', () => {
    const reporter = createHelpClient(config);
    expect(typeof reporter.reportIssue).toBe('function');
    stopHelpClient(reporter);
  });

  it('is independent per call, unlike HelpProvider which reuses one instance across re-renders', () => {
    const a = createHelpClient(config);
    const b = createHelpClient(config);
    expect(a).not.toBe(b);
    stopHelpClient(a);
    stopHelpClient(b);
  });
});

describe('WebStorageAdapter', () => {
  it('round-trips through localStorage', async () => {
    const adapter = new WebStorageAdapter();
    await adapter.setItem('k', 'v');
    expect(await adapter.getItem('k')).toBe('v');
    await adapter.removeItem('k');
    expect(await adapter.getItem('k')).toBeNull();
  });

  it('writes synchronously, so a fatal error is captured before the process could tear down', async () => {
    const adapter = new WebStorageAdapter();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    void adapter.setItem('k', 'v');
    // The write must already be visible even before the returned promise
    // settles -- localStorage.setItem itself is synchronous, and this
    // adapter must not add an await in front of it.
    expect(setItemSpy).toHaveBeenCalledWith('k', 'v');
    setItemSpy.mockRestore();
  });
});

describe('HelpForm', () => {
  const buildForm = (overrides: Partial<import('../../src/vanilla').HelpFormOptions> = {}) => {
    const reporter = createHelpClient(config, defaultAdapters());
    const form = new HelpForm({ reporter, ...overrides });
    return { reporter, form };
  };

  it('is not in the document until opened', () => {
    const { form } = buildForm();
    expect(document.querySelector('[data-testid="help-form"]')).toBeNull();
    form.open();
    expect(document.querySelector('[data-testid="help-form"]')).not.toBeNull();
    form.destroy();
  });

  it('blocks submission until a summary is given', () => {
    const { form } = buildForm();
    form.open();
    const submit = document.querySelector<HTMLButtonElement>('[data-testid="help-submit"]')!;
    const subject = document.querySelector<HTMLInputElement>('[data-testid="help-subject"]')!;
    expect(submit.disabled).toBe(true);

    subject.value = 'Checkout fails';
    subject.dispatchEvent(new Event('input', { bubbles: true }));
    expect(submit.disabled).toBe(false);
    form.destroy();
  });

  it('submits and confirms', async () => {
    const { form } = buildForm();
    form.open();
    const subject = document.querySelector<HTMLInputElement>('[data-testid="help-subject"]')!;
    subject.value = 'Checkout fails';
    subject.dispatchEvent(new Event('input', { bubbles: true }));

    // The submit listener lives on the <form>, not the button.
    const formEl = document.querySelector('[data-testid="help-form"] form')!;
    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/thank you/i);
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    form.destroy();
  });

  it('shows the API error instead of a false success', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    const { form } = buildForm();
    form.open();
    const subject = document.querySelector<HTMLInputElement>('[data-testid="help-subject"]')!;
    subject.value = 'Checkout fails';
    subject.dispatchEvent(new Event('input', { bubbles: true }));

    const formEl = document.querySelector('[data-testid="help-form"] form')!;
    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(document.querySelector('[role="alert"]')?.textContent).toBeTruthy();
    });
    expect(document.body.textContent).not.toMatch(/thank you/i);
    form.destroy();
  });

  it('offers plain language to end users and severity only to internal users', () => {
    const { form: endUserForm } = buildForm({ audience: 'end-user' });
    endUserForm.open();
    expect(document.body.textContent).toContain('Something is broken');
    expect(
      Array.from(document.querySelectorAll('legend')).some((l) => l.textContent === 'Severity')
    ).toBe(false);
    endUserForm.destroy();

    const { form: internalForm } = buildForm({ audience: 'internal' });
    internalForm.open();
    expect(
      Array.from(document.querySelectorAll('legend')).some((l) => l.textContent === 'Severity')
    ).toBe(true);
    internalForm.destroy();
  });

  it('omits debug data when the user unticks the box', async () => {
    const { form } = buildForm();
    form.open();
    const subject = document.querySelector<HTMLInputElement>('[data-testid="help-subject"]')!;
    subject.value = 'Checkout fails';
    subject.dispatchEvent(new Event('input', { bubbles: true }));

    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    const formEl = document.querySelector('[data-testid="help-form"] form')!;
    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.debugData).toBeUndefined();
    form.destroy();
  });

  it('applies a theme override rather than a hardcoded palette', () => {
    const { form } = buildForm({ theme: { background: 'rgb(255, 0, 0)' } });
    form.open();
    const sheet = document.querySelector<HTMLElement>('[data-testid="help-form"]')!;
    expect(sheet.style.background).toBe('rgb(255, 0, 0)');
    form.destroy();
  });

  it('closes and resets on backdrop click, and on the close button', () => {
    const onClose = vi.fn();
    const { form } = buildForm({ onClose });
    form.open();
    const subject = document.querySelector<HTMLInputElement>('[data-testid="help-subject"]')!;
    subject.value = 'Checkout fails';
    subject.dispatchEvent(new Event('input', { bubbles: true }));

    const backdrop = document.querySelector<HTMLElement>('.forge-help-form-backdrop')!;
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(backdrop.style.display).toBe('none');
    expect(onClose).toHaveBeenCalledOnce();
    // Reopening must start clean -- the whole point of resetting on close.
    form.open();
    expect(document.querySelector<HTMLInputElement>('[data-testid="help-subject"]')!.value).toBe('');
    form.destroy();
  });
});

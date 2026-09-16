import type { IssueReporter } from '../core/reporter.js';
import { resolveTheme, lightTheme, type HelpTheme } from '../core/theme.js';
import type { Category, Severity } from '../core/types.js';

export interface HelpFormOptions {
  reporter: IssueReporter;
  /**
   * Audience. 'internal' offers the full engineering vocabulary; 'end-user'
   * offers plain language for the same underlying values.
   *
   * A customer reporting a late delivery should not have to choose between
   * "performance" and "ui-ux"; an engineer filing a bug should not be offered
   * "something is broken". Both land in the same Labs punchlist, tagged so
   * triage can tell them apart. Mirrors the React binding's `HelpForm`.
   */
  audience?: 'internal' | 'end-user';
  theme?: Partial<HelpTheme>;
  baseTheme?: HelpTheme;
  title?: string;
  /** Attach captured logs and device context. Users can opt out. Default true. */
  defaultIncludeDebugData?: boolean;
  onSubmitted?: (issueId?: string) => void;
  /** Called after the form closes, from either the close button or a backdrop click. */
  onClose?: () => void;
}

const INTERNAL_CATEGORIES: Category[] = ['bug', 'feature-request', 'performance', 'ui-ux', 'other'];
const END_USER_CATEGORIES: Category[] = ['bug', 'other', 'feature-request'];
const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];

const END_USER_LABELS: Partial<Record<Category, string>> = {
  bug: 'Something is broken',
  other: 'Question or other issue',
  'feature-request': 'Suggestion',
};

const labelFor = (c: Category, audience: 'internal' | 'end-user'): string =>
  audience === 'end-user' ? (END_USER_LABELS[c] ?? c.replace('-', ' ')) : c.replace('-', ' ');

/**
 * A framework-free DOM port of the React binding's `HelpForm` -- same
 * fields, same submit/thank-you/error states, same theme tokens (so a host
 * that renders both a web React surface and a vanilla one, or is migrating
 * between them, gets visual parity for free). Built with plain
 * `document.createElement`/inline styles rather than a template string, so
 * there is no innerHTML/XSS surface for user-entered text -- every value
 * from the form goes through the DOM's own text-node APIs, never through
 * string concatenation into markup.
 *
 * Unlike the React component (which returns null while `open` is false, so
 * it exists only during render), this class owns its DOM node for its own
 * lifetime once constructed: `open()` inserts it and shows it, `close()`
 * hides it and resets the fields, `destroy()` removes it from the document
 * entirely. Call `destroy()` when the host itself is tearing down (e.g. a
 * hot-reload) to avoid leaking a detached-but-still-referenced overlay.
 */
export class HelpForm {
  private readonly reporter: IssueReporter;
  private readonly audience: 'internal' | 'end-user';
  private readonly theme: HelpTheme;
  private readonly title: string;
  private readonly defaultIncludeDebugData: boolean;
  private readonly onSubmitted?: (issueId?: string) => void;
  private readonly onClose?: () => void;

  private category: Category = 'bug';
  private severity: Severity = 'medium';
  private includeDebugData: boolean;
  private submitting = false;
  private submitted = false;

  private readonly backdrop: HTMLDivElement;
  private readonly sheet: HTMLDivElement;
  private readonly headerTitle: HTMLHeadingElement;
  private readonly body: HTMLDivElement;
  private readonly subjectInput: HTMLInputElement;
  private readonly descriptionInput: HTMLTextAreaElement;
  private readonly stepsInput: HTMLTextAreaElement;
  private readonly emailInput: HTMLInputElement;
  private readonly includeDebugDataCheckbox: HTMLInputElement;
  private readonly categoryChips: HTMLButtonElement[] = [];
  private readonly severityFieldset: HTMLFieldSetElement;
  private readonly severityChips: HTMLButtonElement[] = [];
  private readonly errorParagraph: HTMLParagraphElement;
  private readonly submitButton: HTMLButtonElement;
  private readonly form: HTMLFormElement;
  private readonly thankYou: HTMLDivElement;

  constructor(options: HelpFormOptions) {
    this.reporter = options.reporter;
    this.audience = options.audience ?? 'internal';
    this.theme = resolveTheme(options.theme, options.baseTheme ?? lightTheme);
    this.title = options.title ?? 'Report an issue';
    this.defaultIncludeDebugData = options.defaultIncludeDebugData ?? true;
    this.includeDebugData = this.defaultIncludeDebugData;
    this.onSubmitted = options.onSubmitted;
    this.onClose = options.onClose;

    const t = this.theme;
    const s = styles(t);

    this.backdrop = el('div', s.backdrop, {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': this.title,
    });
    this.backdrop.classList.add('forge-help-form-backdrop');
    this.backdrop.style.display = 'none';
    // "Click outside to close" -- only when the click target is the backdrop
    // itself, not a bubbled click from the sheet's own content.
    this.backdrop.addEventListener('click', (event) => {
      if (event.target === this.backdrop) this.close();
    });

    this.sheet = el('div', s.sheet);
    this.sheet.dataset.testid = 'help-form';
    this.backdrop.appendChild(this.sheet);

    const header = el('div', s.header);
    this.headerTitle = el('h2', s.title, {}, this.title);
    const closeButton = el(
      'button',
      s.close,
      { type: 'button', 'aria-label': 'Close' },
      '×'
    ) as HTMLButtonElement;
    closeButton.addEventListener('click', () => this.close());
    header.append(this.headerTitle, closeButton);
    this.sheet.appendChild(header);

    this.body = el('div', s.body);
    this.sheet.appendChild(this.body);

    // Thank-you state (shown after a successful submit) -- built once,
    // toggled with the form rather than re-created each time.
    this.thankYou = el('div', s.body);
    const thankYouText = el(
      'p',
      s.muted,
      {},
      'Your report was sent. If you left an email address we will follow up there.'
    );
    const doneButton = el('button', s.primary, { type: 'button' }, 'Done') as HTMLButtonElement;
    doneButton.addEventListener('click', () => this.close());
    this.thankYou.append(thankYouText, doneButton);

    // The form itself.
    this.form = document.createElement('form');
    Object.assign(this.form.style, s.body);
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submit();
    });

    const subjectLabel = el('label', s.label, {}, 'Summary');
    this.subjectInput = el('input', s.input, {
      placeholder: 'Briefly, what happened?',
      required: 'true',
    }) as HTMLInputElement;
    this.subjectInput.dataset.testid = 'help-subject';
    this.subjectInput.addEventListener('input', () => this.updateSubmitState());
    subjectLabel.appendChild(this.subjectInput);

    const descriptionLabel = el('label', s.label, {}, 'What went wrong?');
    this.descriptionInput = el('textarea', { ...s.input, minHeight: '96px', resize: 'vertical' }, {
      placeholder: 'Any detail you can give helps.',
    }) as HTMLTextAreaElement;
    this.descriptionInput.dataset.testid = 'help-description';
    descriptionLabel.appendChild(this.descriptionInput);

    const categoryFieldset = el('fieldset', s.fieldset);
    categoryFieldset.appendChild(el('legend', s.legend, {}, 'Type'));
    const categoryChipsRow = el('div', s.chips);
    for (const category of this.categoriesForAudience()) {
      const chip = el(
        'button',
        category === this.category ? s.chipActive : s.chip,
        { type: 'button' },
        labelFor(category, this.audience)
      ) as HTMLButtonElement;
      chip.addEventListener('click', () => {
        this.category = category;
        this.refreshChipStyles();
      });
      this.categoryChips.push(chip);
      categoryChipsRow.appendChild(chip);
    }
    categoryFieldset.appendChild(categoryChipsRow);

    // Built, but only ever attached to the form for 'internal' audience —
    // absent from the DOM entirely for 'end-user', matching the React
    // binding's conditional render (`audience === 'internal' && <fieldset>`)
    // rather than merely hidden, so neither binding's markup can be
    // distinguished from the other by inspecting what's actually present.
    this.severityFieldset = el('fieldset', s.fieldset) as HTMLFieldSetElement;
    this.severityFieldset.appendChild(el('legend', s.legend, {}, 'Severity'));
    const severityChipsRow = el('div', s.chips);
    for (const severity of SEVERITIES) {
      const chip = el(
        'button',
        severity === this.severity ? s.chipActive : s.chip,
        { type: 'button' },
        severity
      ) as HTMLButtonElement;
      chip.addEventListener('click', () => {
        this.severity = severity;
        this.refreshChipStyles();
      });
      this.severityChips.push(chip);
      severityChipsRow.appendChild(chip);
    }
    this.severityFieldset.appendChild(severityChipsRow);

    const stepsLabel = el('label', s.label);
    stepsLabel.append('Steps to reproduce ', el('span', s.optional, {}, '(optional)'));
    this.stepsInput = el('textarea', { ...s.input, minHeight: '64px', resize: 'vertical' }) as HTMLTextAreaElement;
    stepsLabel.appendChild(this.stepsInput);

    const emailLabel = el('label', s.label);
    emailLabel.append('Email ', el('span', s.optional, {}, '(optional)'));
    this.emailInput = el('input', s.input, {
      type: 'email',
      placeholder: 'So we can follow up',
    }) as HTMLInputElement;
    emailLabel.appendChild(this.emailInput);

    const checkboxLabel = el('label', s.checkbox);
    this.includeDebugDataCheckbox = el('input', {}, { type: 'checkbox' }) as HTMLInputElement;
    this.includeDebugDataCheckbox.checked = this.includeDebugData;
    this.includeDebugDataCheckbox.addEventListener('change', () => {
      this.includeDebugData = this.includeDebugDataCheckbox.checked;
    });
    const checkboxText = el(
      'span',
      s.muted,
      {},
      'Include recent logs and device info. This makes the problem far easier to find.'
    );
    checkboxLabel.append(this.includeDebugDataCheckbox, checkboxText);

    this.errorParagraph = el('p', s.error, { role: 'alert' }) as HTMLParagraphElement;
    this.errorParagraph.style.display = 'none';

    this.submitButton = el('button', s.primaryDisabled, { type: 'submit' }, 'Send report') as HTMLButtonElement;
    this.submitButton.dataset.testid = 'help-submit';
    this.submitButton.disabled = true;

    this.form.append(subjectLabel, descriptionLabel, categoryFieldset);
    if (this.audience === 'internal') this.form.append(this.severityFieldset);
    this.form.append(stepsLabel, emailLabel, checkboxLabel, this.errorParagraph, this.submitButton);

    this.body.appendChild(this.form);
  }

  private categoriesForAudience(): Category[] {
    return this.audience === 'end-user' ? END_USER_CATEGORIES : INTERNAL_CATEGORIES;
  }

  private refreshChipStyles(): void {
    const s = styles(this.theme);
    for (const [index, category] of this.categoriesForAudience().entries()) {
      Object.assign(this.categoryChips[index]!.style, category === this.category ? s.chipActive : s.chip);
    }
    for (const [index, severity] of SEVERITIES.entries()) {
      Object.assign(this.severityChips[index]!.style, severity === this.severity ? s.chipActive : s.chip);
    }
  }

  private updateSubmitState(): void {
    const s = styles(this.theme);
    const canSubmit = !this.submitting && this.subjectInput.value.trim().length > 0;
    this.submitButton.disabled = !canSubmit;
    Object.assign(this.submitButton.style, canSubmit ? s.primary : s.primaryDisabled);
  }

  private showError(message: string): void {
    this.errorParagraph.textContent = message;
    this.errorParagraph.style.display = '';
  }

  private clearError(): void {
    this.errorParagraph.textContent = '';
    this.errorParagraph.style.display = 'none';
  }

  private async submit(): Promise<void> {
    const subject = this.subjectInput.value.trim();
    if (!subject || this.submitting) return;

    this.submitting = true;
    this.updateSubmitState();
    this.submitButton.textContent = 'Sending…';
    this.clearError();

    const result = await this.reporter.reportIssue({
      title: subject,
      description: this.descriptionInput.value.trim(),
      severity: this.severity,
      category: this.category,
      contactEmail: this.emailInput.value.trim() || undefined,
      replicationSteps: this.stepsInput.value.trim() || undefined,
      // Honouring the opt-out has to mean the logs never leave the device --
      // not a flag on a payload that carries them anyway.
      includeDebugData: this.includeDebugData,
    });

    this.submitting = false;
    this.submitButton.textContent = 'Send report';
    this.updateSubmitState();

    if (result.success) {
      this.submitted = true;
      this.headerTitle.textContent = 'Thank you';
      this.body.replaceWith(this.thankYou);
      this.onSubmitted?.(result.issueId);
    } else {
      this.showError(result.error ?? 'Could not send the report. Please try again.');
    }
  }

  private reset(): void {
    this.subjectInput.value = '';
    this.descriptionInput.value = '';
    this.stepsInput.value = '';
    this.emailInput.value = '';
    this.category = 'bug';
    this.severity = 'medium';
    this.includeDebugData = this.defaultIncludeDebugData;
    this.includeDebugDataCheckbox.checked = this.includeDebugData;
    this.refreshChipStyles();
    this.clearError();
    this.updateSubmitState();
    if (this.submitted) {
      this.submitted = false;
      this.headerTitle.textContent = this.title;
      this.thankYou.replaceWith(this.body);
    }
  }

  /** Inserts the form into `document.body` (if not already) and shows it. */
  open(): void {
    if (!this.backdrop.isConnected) document.body.appendChild(this.backdrop);
    this.backdrop.style.display = 'flex';
    this.subjectInput.focus();
  }

  /** Hides the form and resets every field, so the next `open()` starts clean. */
  close(): void {
    this.backdrop.style.display = 'none';
    this.reset();
    this.onClose?.();
  }

  /** Removes the form from the document entirely. */
  destroy(): void {
    this.backdrop.remove();
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration> = {},
  attrs: Record<string, string> = {},
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'required') node.setAttribute('required', '');
    else node.setAttribute(key, value);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

function styles(t: HelpTheme): Record<string, Partial<CSSStyleDeclaration>> {
  const chipBase: Partial<CSSStyleDeclaration> = {
    padding: '0.35rem 0.75rem',
    borderRadius: '999px',
    border: `1px solid ${t.border}`,
    background: t.surfaceAlt,
    color: t.textMuted,
    font: 'inherit',
    fontSize: '0.875rem',
    cursor: 'pointer',
    textTransform: 'capitalize',
  };

  const primaryBase: Partial<CSSStyleDeclaration> = {
    padding: '0.75rem 1rem',
    borderRadius: `${t.radius}px`,
    border: 'none',
    background: t.accent,
    color: t.accentText,
    font: 'inherit',
    fontWeight: '600',
    cursor: 'pointer',
  };

  return {
    backdrop: {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      zIndex: '1000',
    },
    sheet: {
      width: '100%',
      maxWidth: '32rem',
      maxHeight: '90vh',
      overflowY: 'auto',
      background: t.background,
      color: t.text,
      borderRadius: `${t.radius * 1.5}px`,
      border: `1px solid ${t.border}`,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem 1.25rem',
      borderBottom: `1px solid ${t.border}`,
    },
    title: { margin: '0', fontSize: '1.05rem' },
    close: {
      background: 'none',
      border: 'none',
      color: t.textMuted,
      fontSize: '1.5rem',
      lineHeight: '1',
      cursor: 'pointer',
      padding: '0',
    },
    body: { display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' },
    label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.875rem' },
    optional: { color: t.textMuted, fontWeight: '400' },
    input: {
      padding: '0.6rem 0.75rem',
      borderRadius: `${t.radius}px`,
      border: `1px solid ${t.border}`,
      background: t.surface,
      color: t.text,
      font: 'inherit',
    },
    fieldset: { border: 'none', padding: '0', margin: '0' },
    legend: { padding: '0', fontSize: '0.875rem', marginBottom: '0.35rem' },
    chips: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
    chip: chipBase,
    chipActive: {
      ...chipBase,
      background: t.accent,
      borderColor: t.accent,
      color: t.accentText,
    },
    checkbox: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.8125rem' },
    muted: { color: t.textMuted, margin: '0' },
    error: { color: t.danger, margin: '0', fontSize: '0.875rem' },
    primary: primaryBase,
    primaryDisabled: { ...primaryBase, opacity: '0.5', cursor: 'not-allowed' },
  };
}

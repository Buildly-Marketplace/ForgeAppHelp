import { useMemo, useState, type CSSProperties } from 'react';
import { useReporter } from './context.js';
import { resolveTheme, lightTheme, type HelpTheme } from '../core/theme.js';
import type { Category, Severity } from '../core/types.js';

export interface HelpFormProps {
  open: boolean;
  onClose: () => void;
  /**
   * Audience. 'internal' offers the full engineering vocabulary; 'end-user'
   * offers plain language for the same underlying values.
   *
   * A customer reporting a late delivery should not have to choose between
   * "performance" and "ui-ux"; an engineer filing a bug should not be offered
   * "something is broken". Both land in the same Labs punchlist, tagged so
   * triage can tell them apart.
   */
  audience?: 'internal' | 'end-user';
  theme?: Partial<HelpTheme>;
  baseTheme?: HelpTheme;
  title?: string;
  /** Attach captured logs and device context. Users can opt out. */
  defaultIncludeDebugData?: boolean;
  onSubmitted?: (issueId?: string) => void;
}

const INTERNAL_CATEGORIES: Category[] = ['bug', 'feature-request', 'performance', 'ui-ux', 'other'];
const END_USER_CATEGORIES: Category[] = ['bug', 'other', 'feature-request'];
const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];

const END_USER_LABELS: Partial<Record<Category, string>> = {
  bug: 'Something is broken',
  other: 'Question or other issue',
  'feature-request': 'Suggestion',
};

export function HelpForm({
  open,
  onClose,
  audience = 'internal',
  theme,
  baseTheme = lightTheme,
  title = 'Report an issue',
  defaultIncludeDebugData = true,
  onSubmitted,
}: HelpFormProps) {
  const reporter = useReporter();
  const t = useMemo(() => resolveTheme(theme, baseTheme), [theme, baseTheme]);

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('bug');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [email, setEmail] = useState('');
  const [steps, setSteps] = useState('');
  const [includeDebugData, setIncludeDebugData] = useState(defaultIncludeDebugData);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = audience === 'end-user' ? END_USER_CATEGORIES : INTERNAL_CATEGORIES;
  const labelFor = (c: Category) =>
    audience === 'end-user' ? (END_USER_LABELS[c] ?? c.replace('-', ' ')) : c.replace('-', ' ');

  if (!open) return null;

  const reset = () => {
    setSubject('');
    setDescription('');
    setCategory('bug');
    setSeverity('medium');
    setEmail('');
    setSteps('');
    setSubmitted(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    const result = await reporter.reportIssue({
      title: subject.trim(),
      description: description.trim(),
      severity,
      category,
      contactEmail: email.trim() || undefined,
      replicationSteps: steps.trim() || undefined,
      // Honouring the opt-out has to mean the logs never leave the device --
      // not a flag on a payload that carries them anyway.
      includeDebugData,
    });

    setSubmitting(false);

    if (result.success) {
      setSubmitted(true);
      onSubmitted?.(result.issueId);
    } else {
      setError(result.error ?? 'Could not send the report. Please try again.');
    }
  };

  const s = styles(t);

  return (
    <div style={s.backdrop} role="dialog" aria-modal="true" aria-label={title}>
      <div style={s.sheet} data-testid="help-form">
        <div style={s.header}>
          <h2 style={s.title}>{submitted ? 'Thank you' : title}</h2>
          <button type="button" onClick={handleClose} style={s.close} aria-label="Close">
            ×
          </button>
        </div>

        {submitted ? (
          <div style={s.body}>
            <p style={s.muted}>
              Your report was sent. If you left an email address we will follow up there.
            </p>
            <button type="button" onClick={handleClose} style={s.primary}>
              Done
            </button>
          </div>
        ) : (
          <form style={s.body} onSubmit={handleSubmit}>
            <label style={s.label}>
              Summary
              <input
                style={s.input}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Briefly, what happened?"
                required
                data-testid="help-subject"
              />
            </label>

            <label style={s.label}>
              What went wrong?
              <textarea
                style={{ ...s.input, minHeight: 96, resize: 'vertical' }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Any detail you can give helps."
                data-testid="help-description"
              />
            </label>

            <fieldset style={s.fieldset}>
              <legend style={s.legend}>Type</legend>
              <div style={s.chips}>
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    style={c === category ? s.chipActive : s.chip}
                  >
                    {labelFor(c)}
                  </button>
                ))}
              </div>
            </fieldset>

            {audience === 'internal' && (
              <fieldset style={s.fieldset}>
                <legend style={s.legend}>Severity</legend>
                <div style={s.chips}>
                  {SEVERITIES.map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverity(sev)}
                      style={sev === severity ? s.chipActive : s.chip}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <label style={s.label}>
              Steps to reproduce <span style={s.optional}>(optional)</span>
              <textarea
                style={{ ...s.input, minHeight: 64, resize: 'vertical' }}
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
            </label>

            <label style={s.label}>
              Email <span style={s.optional}>(optional)</span>
              <input
                style={s.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="So we can follow up"
              />
            </label>

            <label style={s.checkbox}>
              <input
                type="checkbox"
                checked={includeDebugData}
                onChange={(e) => setIncludeDebugData(e.target.checked)}
              />
              <span style={s.muted}>
                Include recent logs and device info. This makes the problem far easier to find.
              </span>
            </label>

            {error && (
              <p style={s.error} role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              style={submitting || !subject.trim() ? s.primaryDisabled : s.primary}
              disabled={submitting || !subject.trim()}
              data-testid="help-submit"
            >
              {submitting ? 'Sending…' : 'Send report'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function styles(t: HelpTheme): Record<string, CSSProperties> {
  const chipBase: CSSProperties = {
    padding: '0.35rem 0.75rem',
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: t.surfaceAlt,
    color: t.textMuted,
    font: 'inherit',
    fontSize: '0.875rem',
    cursor: 'pointer',
    textTransform: 'capitalize',
  };

  const primaryBase: CSSProperties = {
    padding: '0.75rem 1rem',
    borderRadius: t.radius,
    border: 'none',
    background: t.accent,
    color: t.accentText,
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
  };

  return {
    backdrop: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      zIndex: 1000,
    },
    sheet: {
      width: '100%',
      maxWidth: '32rem',
      maxHeight: '90vh',
      overflowY: 'auto',
      background: t.background,
      color: t.text,
      borderRadius: t.radius * 1.5,
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
    title: { margin: 0, fontSize: '1.05rem' },
    close: {
      background: 'none',
      border: 'none',
      color: t.textMuted,
      fontSize: '1.5rem',
      lineHeight: 1,
      cursor: 'pointer',
      padding: 0,
    },
    body: { display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' },
    label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.875rem' },
    optional: { color: t.textMuted, fontWeight: 400 },
    input: {
      padding: '0.6rem 0.75rem',
      borderRadius: t.radius,
      border: `1px solid ${t.border}`,
      background: t.surface,
      color: t.text,
      font: 'inherit',
    },
    fieldset: { border: 'none', padding: 0, margin: 0 },
    legend: { padding: 0, fontSize: '0.875rem', marginBottom: '0.35rem' },
    chips: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
    chip: chipBase,
    chipActive: {
      ...chipBase,
      background: t.accent,
      borderColor: t.accent,
      color: t.accentText,
    },
    checkbox: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.8125rem' },
    muted: { color: t.textMuted, margin: 0 },
    error: { color: t.danger, margin: 0, fontSize: '0.875rem' },
    primary: primaryBase,
    primaryDisabled: { ...primaryBase, opacity: 0.5, cursor: 'not-allowed' },
  };
}

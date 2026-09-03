/**
 * Colours the help form uses.
 *
 * The version this was extracted from hardcoded 21 hex values inline, which is
 * why it rendered dark against a light-themed host and could not be fixed
 * without editing the component. Pass a partial `theme` to override only what
 * differs; anything omitted falls back to the default.
 */
export interface HelpTheme {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  danger: string;
  success: string;
  radius: number;
}

export const darkTheme: HelpTheme = {
  background: '#0f1117',
  surface: '#171a23',
  surfaceAlt: '#1f2430',
  border: '#262b38',
  text: '#e8eaf0',
  textMuted: '#949bad',
  accent: '#4f7cff',
  accentText: '#ffffff',
  danger: '#ef4444',
  success: '#22c55e',
  radius: 12,
};

export const lightTheme: HelpTheme = {
  background: '#ffffff',
  surface: '#f8f9fb',
  surfaceAlt: '#eef0f5',
  border: '#e5e7eb',
  text: '#1d2025',
  textMuted: '#586474',
  accent: '#4f7cff',
  accentText: '#ffffff',
  danger: '#dc2626',
  success: '#16a34a',
  radius: 12,
};

export const resolveTheme = (overrides?: Partial<HelpTheme>, base: HelpTheme = lightTheme): HelpTheme => ({
  ...base,
  ...overrides,
});

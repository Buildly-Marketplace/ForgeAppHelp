import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpProvider, HelpForm, ErrorBoundary, useReporter } from '../../src/react';
import Demo from '../../example/Demo';

const config = { productId: 'p', apiKey: 'k', isTestMode: true };

let fetchMock: ReturnType<typeof vi.fn>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'issue-1' }), { status: 201 }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('HelpProvider', () => {
  it('gives children a reporter', () => {
    const seen: string[] = [];
    function Probe() {
      const reporter = useReporter();
      seen.push(typeof reporter.reportIssue);
      return null;
    }

    render(
      <HelpProvider config={config}>
        <Probe />
      </HelpProvider>
    );

    expect(seen[0]).toBe('function');
  });

  it('fails loudly outside a provider, rather than silently dropping reports', () => {
    function Probe() {
      useReporter();
      return null;
    }
    // React logs the thrown error; silence it so the run stays readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(/HelpProvider/);
    spy.mockRestore();
  });

  it('keeps the same reporter across re-renders, so logs are not lost', () => {
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useReporter());
      return null;
    }

    const { rerender } = render(
      <HelpProvider config={config}>
        <Probe />
      </HelpProvider>
    );
    rerender(
      <HelpProvider config={config}>
        <Probe />
      </HelpProvider>
    );

    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });
});

describe('HelpForm', () => {
  const openForm = (props: Partial<React.ComponentProps<typeof HelpForm>> = {}) =>
    render(
      <HelpProvider config={config}>
        <HelpForm open onClose={() => {}} {...props} />
      </HelpProvider>
    );

  it('renders nothing when closed', () => {
    render(
      <HelpProvider config={config}>
        <HelpForm open={false} onClose={() => {}} />
      </HelpProvider>
    );
    expect(screen.queryByTestId('help-form')).not.toBeInTheDocument();
  });

  it('blocks submission until a summary is given', async () => {
    openForm();
    expect(screen.getByTestId('help-submit')).toBeDisabled();

    await userEvent.type(screen.getByTestId('help-subject'), 'Checkout fails');
    expect(screen.getByTestId('help-submit')).toBeEnabled();
  });

  it('submits and confirms', async () => {
    openForm();
    await userEvent.type(screen.getByTestId('help-subject'), 'Checkout fails');
    await userEvent.click(screen.getByTestId('help-submit'));

    await waitFor(() => expect(screen.getByText(/thank you/i)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('shows the API error instead of a false success', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    openForm();

    await userEvent.type(screen.getByTestId('help-subject'), 'Checkout fails');
    await userEvent.click(screen.getByTestId('help-submit'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(/thank you/i)).not.toBeInTheDocument();
  });

  it('offers plain language to end users and severity only to internal users', () => {
    const { unmount } = openForm({ audience: 'end-user' });
    expect(screen.getByText('Something is broken')).toBeInTheDocument();
    expect(screen.queryByText('Severity')).not.toBeInTheDocument();
    unmount();

    openForm({ audience: 'internal' });
    expect(screen.getByText('Severity')).toBeInTheDocument();
  });

  it('omits debug data when the user unticks the box', async () => {
    openForm();
    await userEvent.type(screen.getByTestId('help-subject'), 'Checkout fails');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByTestId('help-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.debugData).toBeUndefined();
  });

  it('applies a theme override rather than a hardcoded palette', () => {
    openForm({ theme: { background: 'rgb(255, 0, 0)' } });
    expect(screen.getByTestId('help-form')).toHaveStyle({ background: 'rgb(255, 0, 0)' });
  });
});

describe('ErrorBoundary', () => {
  function Boom(): React.ReactElement {
    throw new Error('render exploded');
  }

  it('shows a fallback and files the error with its component stack', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reporter = { logError: vi.fn() };

    render(
      <ErrorBoundary reporter={reporter as never}>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('render exploded');
    expect(reporter.logError).toHaveBeenCalledWith(
      'react-error-boundary',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
    spy.mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });
});

/** The three hooks BUILDLY.yaml declares. Marketplace CI asserts the same. */
describe('marketplace UI hooks', () => {
  it('renders app-root and reveals panel from primary-action', async () => {
    render(<Demo />);

    expect(screen.getByTestId('app-root')).toBeInTheDocument();
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('primary-action'));
    expect(screen.getByTestId('panel')).toBeVisible();
  });
});

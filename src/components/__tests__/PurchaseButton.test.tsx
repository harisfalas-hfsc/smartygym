import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PurchaseButton } from '../PurchaseButton';
import { useAccessControl } from '@/hooks/useAccessControl';
import { BrowserRouter } from 'react-router-dom';

// Mock the useAccessControl hook
vi.mock('@/hooks/useAccessControl');

// Purchasing switches: these tests cover normal selling mode
// (Free Access Mode off, platform payments enabled).
vi.mock('@/hooks/useFreeAccessMode', () => ({
  useFreeAccessMode: () => ({ freeAccessMode: false, loading: false }),
  fetchFreeAccessMode: () => Promise.resolve(false),
}));
vi.mock('@/hooks/usePaymentsEnabled', () => ({
  usePaymentsEnabled: () => ({ platform: 'web', paymentsEnabled: true, loading: false }),
  getPaymentPlatform: () => 'web',
}));

// Mock NavigationHistory (PurchaseButton uses useNavigationHistory)
vi.mock('@/contexts/NavigationHistoryContext', () => ({
  useNavigationHistory: () => ({
    history: [],
    goBack: vi.fn(),
    canGoBack: false,
    goForward: vi.fn(),
    canGoForward: false,
  }),
}));

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    },
  },
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('PurchaseButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Included in Your Premium Plan" for premium users', () => {
    vi.mocked(useAccessControl).mockReturnValue({
      userTier: 'premium',
      hasPurchased: vi.fn(() => false),
      user: { id: '123' } as any,
      isLoading: false,
      productId: 'lifetime',
      purchasedContent: new Set(),
      canAccessContent: vi.fn(() => true),
      canInteract: vi.fn(() => true),
      refreshAccess: vi.fn(),
    });

    const { getByText, getByRole } = render(<TestWrapper><PurchaseButton
        contentId="workout-1"
        contentType="workout"
        contentName="Test Workout"
        price={29.99}
      /></TestWrapper>);

    expect(getByText(/Included in Your Premium Plan/i)).toBeInTheDocument();
    expect(getByRole('button')).toBeDisabled();
  });

  it('shows purchase button with price for free users', () => {
    vi.mocked(useAccessControl).mockReturnValue({
      userTier: 'subscriber',
      hasPurchased: vi.fn(() => false),
      user: { id: '123' } as any,
      isLoading: false,
      productId: null,
      purchasedContent: new Set(),
      canAccessContent: vi.fn(() => false),
      canInteract: vi.fn(() => true),
      refreshAccess: vi.fn(),
    });

    const { getByText, getByRole } = render(<TestWrapper><PurchaseButton
        contentId="workout-1"
        contentType="workout"
        contentName="Test Workout"
        price={29.99}
      /></TestWrapper>);

    expect(getByText(/Purchase for €29.99/i)).toBeInTheDocument();
    expect(getByRole('button')).not.toBeDisabled();
  });

  it('shows "Already Purchased" for purchased content', () => {
    vi.mocked(useAccessControl).mockReturnValue({
      userTier: 'subscriber',
      hasPurchased: vi.fn(() => true),
      user: { id: '123' } as any,
      isLoading: false,
      productId: null,
      purchasedContent: new Set(['workout:workout-1']),
      canAccessContent: vi.fn(() => true),
      canInteract: vi.fn(() => true),
      refreshAccess: vi.fn(),
    });

    const { getByText, getByRole } = render(<TestWrapper><PurchaseButton
        contentId="workout-1"
        contentType="workout"
        contentName="Test Workout"
        price={29.99}
      /></TestWrapper>);

    expect(getByText(/Already Purchased/i)).toBeInTheDocument();
    expect(getByRole('button')).toBeDisabled();
  });

  it('shows login prompt for guests', () => {
    vi.mocked(useAccessControl).mockReturnValue({
      userTier: 'guest',
      hasPurchased: vi.fn(() => false),
      user: null,
      isLoading: false,
      productId: null,
      purchasedContent: new Set(),
      canAccessContent: vi.fn(() => false),
      canInteract: vi.fn(() => false),
      refreshAccess: vi.fn(),
    });

    const { getByText } = render(<TestWrapper><PurchaseButton
        contentId="workout-1"
        contentType="workout"
        contentName="Test Workout"
        price={29.99}
      /></TestWrapper>);

    // Guest sees the regular purchase button; clicking it triggers auth redirect.
    expect(getByText(/Purchase for €29.99/i)).toBeInTheDocument();
  });

  it('formats price correctly', () => {
    vi.mocked(useAccessControl).mockReturnValue({
      userTier: 'subscriber',
      hasPurchased: vi.fn(() => false),
      user: { id: '123' } as any,
      isLoading: false,
      productId: null,
      purchasedContent: new Set(),
      canAccessContent: vi.fn(() => false),
      canInteract: vi.fn(() => true),
      refreshAccess: vi.fn(),
    });

    const { getByText } = render(<TestWrapper><PurchaseButton
        contentId="workout-1"
        contentType="workout"
        contentName="Test Workout"
        price={19.5}
      /></TestWrapper>);

    expect(getByText(/€19.50/i)).toBeInTheDocument();
  });
});

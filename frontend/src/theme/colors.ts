/**
 * TrustLayer Visual Identity & Design System Color Tokens
 * Defined per docs/04 UI/UX & Dashboard Brief §1
 */

export const colors = {
  // Brand & Structural
  navy: '#1E3A8A', // Primary structural surfaces and headers
  blue: '#2563EB', // Interactive elements, primary actions, and neutral states
  blueDark: '#1D4ED8',
  blueLight: '#DBEAFE',

  // Decision & State Badges (Must map strictly to semantic colors)
  green: '#059669', // Grounding-verified indicators & ALLOW decision badges
  greenLight: '#D1FAE5',
  greenBorder: '#10B981',

  amber: '#D97706', // Pending review indicators & APPROVE decision badges
  amberLight: '#FEF3C7',
  amberBorder: '#F59E0B',

  red: '#DC2626', // Security firewall violations & BLOCK decision badges
  redLight: '#FEE2E2',
  redBorder: '#EF4444',

  purple: '#7C3AED', // Multi-input risk fusion & decision engine analytics
  purpleLight: '#EDE9FE',
  purpleBorder: '#8B5CF6',

  // Neutrals & Surfaces
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
} as const;

export type DecisionType = 'allow' | 'approve' | 'block';

export function getDecisionBadgeStyles(decision: string | null | undefined) {
  const norm = (decision || '').toLowerCase();
  if (norm === 'allow') {
    return {
      bg: colors.greenLight,
      color: colors.green,
      border: colors.greenBorder,
      label: 'ALLOW',
    };
  }
  if (norm === 'approve') {
    return {
      bg: colors.amberLight,
      color: colors.amber,
      border: colors.amberBorder,
      label: 'APPROVE',
    };
  }
  if (norm === 'block') {
    return {
      bg: colors.redLight,
      color: colors.red,
      border: colors.redBorder,
      label: 'BLOCK',
    };
  }
  return {
    bg: '#F1F5F9',
    color: colors.textSecondary,
    border: colors.border,
    label: norm.toUpperCase() || 'UNKNOWN',
  };
}


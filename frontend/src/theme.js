/**
 * Ant Design theme.
 *
 * Mirrors styles/tokens.css. AntD computes its own component styles in JS and
 * can't read CSS custom properties, so the values are duplicated here — this
 * file and tokens.css are the only two places a raw colour may appear, and
 * they must be changed together.
 */

// Keep in sync with :root in styles/tokens.css
const t = {
  accent: '#1f4d7a',
  accentHover: '#29618f',
  text: '#171717',
  textSecondary: '#6b6b6b',
  border: '#ebebeb',
  borderStrong: '#e0e0e0',
  surface: '#ffffff',
  neutral50: '#fafafa',
  neutral100: '#f5f5f5',
  success: '#2e7d32',
  warning: '#a16207',
  danger: '#b3261e',
  radius: 6,
  radiusSm: 4,
  fontBase: 14,
  fontSm: 13,
  fontXs: 12,
};

const theme = {
  token: {
    colorPrimary: t.accent,
    colorLink: t.accent,
    colorLinkHover: t.accentHover,
    colorSuccess: t.success,
    colorWarning: t.warning,
    colorError: t.danger,
    colorInfo: t.accent,

    colorText: t.text,
    colorTextSecondary: t.textSecondary,
    colorBorder: t.borderStrong,
    colorBorderSecondary: t.border,
    colorBgContainer: t.surface,
    colorBgLayout: t.surface,

    borderRadius: t.radius,
    borderRadiusSM: t.radiusSm,
    borderRadiusLG: t.radius,

    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: t.fontBase,
    lineHeight: 1.6,

    controlHeight: 34,

    // Resting surfaces are flat; only overlays get elevation (see index.css).
    boxShadow: 'none',
    boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.10)',
    boxShadowTertiary: 'none',

    // 4px spacing scale.
    padding: 16,
    margin: 16,
  },

  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      fontWeight: 500,
    },
    Card: {
      borderRadiusLG: t.radius,
      boxShadowTertiary: 'none',
      paddingLG: 20,
    },
    Table: {
      headerBg: 'transparent',
      headerColor: t.textSecondary,
      headerSplitColor: 'transparent',
      rowHoverBg: t.neutral50,
      borderColor: t.border,
      fontSize: t.fontSm,

      // Density is deliberate: reps scan hundreds of rows, so tight is correct.
      // All three sizes must be set — AntD's per-size rules carry more class
      // specificity than any plain .premium-table selector, so setting only the
      // default leaves `size="middle"` and `size="small"` tables on AntD's
      // defaults (which are actually *taller*: 12px block).
      cellPaddingBlock: 8,
      cellPaddingInline: 12,
      cellPaddingBlockMD: 8,
      cellPaddingInlineMD: 12,
      cellPaddingBlockSM: 6,
      cellPaddingInlineSM: 8,
    },
    Menu: {
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemSelectedBg: '#f0f4f8',
      itemSelectedColor: t.accent,
      itemHoverBg: t.neutral100,
      itemColor: t.textSecondary,
      itemHeight: 36,
      iconSize: 16,
      activeBarWidth: 0,
      activeBarBorderWidth: 0,
    },
    Input: {
      activeBorderColor: t.accent,
      hoverBorderColor: t.borderStrong,
      activeShadow: '0 0 0 2px #cddbe8',
    },
    Select: {
      optionSelectedBg: '#f0f4f8',
      optionSelectedColor: t.accent,
    },
    Tag: {
      defaultBg: t.neutral100,
      defaultColor: t.textSecondary,
      borderRadiusSM: t.radiusSm,
    },
    Statistic: {
      titleFontSize: t.fontXs,
      contentFontSize: 28,
    },
    Layout: {
      headerBg: t.surface,
      bodyBg: t.surface,
      siderBg: t.neutral50,
      headerHeight: 56,
      headerPadding: '0 24px',
    },
    Modal: {
      borderRadiusLG: t.radius,
    },
    Tabs: {
      titleFontSize: t.fontBase,
      inkBarColor: t.accent,
      itemSelectedColor: t.accent,
    },
    Segmented: {
      itemSelectedBg: t.surface,
      trackBg: t.neutral100,
    },
  },
};

export default theme;

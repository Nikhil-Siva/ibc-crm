/**
 * Chart colours.
 *
 * Charts need literal values: Recharts writes these into SVG presentation
 * attributes (fill="…", stroke="…"), and `var(--token)` is not resolved there.
 * So these mirror styles/tokens.css by hand — keep them in sync.
 *
 * The series ramp is one hue at descending strength rather than a rainbow.
 * Categorical hues imply the categories are unrelated; here they're usually
 * stages of the same funnel, and a ramp reads as ordered.
 */

export const CHART = {
  // Primary series, strongest first.
  series: ['#1f4d7a', '#4a7fab', '#83a9c9', '#bcd0e0'],

  primary: '#1f4d7a',
  secondary: '#4a7fab',

  // Reserved for meaning, not variety.
  success: '#2e7d32',
  warning: '#a16207',
  danger: '#b3261e',

  grid: '#ebebeb',
  axis: '#8c8c8c',
  label: '#6b6b6b',
};

export default CHART;

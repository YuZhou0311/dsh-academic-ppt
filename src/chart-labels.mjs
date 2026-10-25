/** Label formatting shared by the visible-content gate and both chart exports.
 * Formatting never changes the observations stored in the native chart/workbook.
 */
const displayFormats = new Map();
export function chartDisplayValue(value, chart) {
  const decimals = chart.valueDecimals, key = decimals ?? 'default';
  if (!displayFormats.has(key)) displayFormats.set(key, new Intl.NumberFormat('en-US', {
    useGrouping: false, minimumFractionDigits: decimals ?? 0, maximumFractionDigits: decimals ?? 12,
    // Match native decimal rounding (2.675 -> 2.68), avoiding toFixed's binary
    // rounding drift, and suppress the minus sign when the displayed value is zero.
    roundingMode: 'halfExpand', signDisplay: 'negative',
  }));
  return displayFormats.get(key).format(value);
}

export const chartValueFormat = chart => chart.valueDecimals === undefined
  ? '0.############' : chart.valueDecimals ? '0.' + '0'.repeat(chart.valueDecimals) : '0';

/** Only text actually shown by the chart renderer, not workbook metadata. */
export function chartVisibleText(chart = {}) {
  const series = Array.isArray(chart.series) ? chart.series : [];
  return [
    ...(Array.isArray(chart.categories) ? chart.categories : []),
    ...(series.length > 1 ? series.map(item => item.name) : []),
    ...(chart.kind === 'line' ? [] : series.flatMap(item =>
      (Array.isArray(item.values) ? item.values : []).map(value => chartDisplayValue(value, chart)))),
    chart.unit,
  ].filter(value => value !== undefined).map(String);
}

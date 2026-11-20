/**
 * Vote statistics for a revealed round. Pure and dependency-free so it can be
 * unit-tested directly and reused by PERT (STORY-012), which will add its own
 * weighted-estimate / std-dev fields alongside these.
 *
 * Input is an array of vote-shaped objects with a `value` string (the free-form
 * estimate). Non-numeric entries on the scale (e.g. '?') are counted in the
 * distribution but excluded from the numeric stats.
 */
export function computeStats(votes) {
  const values = votes.map((v) => v.value).filter((v) => v != null);
  const numbers = values.map(Number).filter((n) => Number.isFinite(n));

  const numericCount = numbers.length;
  const average = numericCount
    ? Math.round((numbers.reduce((a, b) => a + b, 0) / numericCount) * 100) / 100
    : null;
  const min = numericCount ? Math.min(...numbers) : null;
  const max = numericCount ? Math.max(...numbers) : null;

  return {
    count: values.length,
    numericCount,
    average,
    min,
    max,
    spread: numericCount ? max - min : null,
    consensus: values.length > 0 && values.every((v) => v === values[0]),
    distribution: distributionOf(values),
  };
}

// Counts per distinct value, ordered numerically ascending with non-numeric
// values (e.g. '?') last in first-seen order — a stable order for display.
function distributionOf(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      const na = Number(a.value);
      const nb = Number(b.value);
      const aNum = Number.isFinite(na);
      const bNum = Number.isFinite(nb);
      if (aNum && bNum) return na - nb;
      if (aNum) return -1;
      if (bNum) return 1;
      return 0;
    });
}

import {validateMetadata} from './core.js';

// Exact basenames only: never guess a listing from row order or a similar name.
export function matchDesigns(files, rows, overrides = new Map()) {
  const counts = new Map();
  for (const file of files) counts.set(file.name, (counts.get(file.name) || 0) + 1);
  return files.map((file, index) => {
    let rowIndex = overrides.has(index) ? overrides.get(index) : rows.findIndex(r => r.filename === file.name);
    const matches = rows.filter(r => r.filename === file.name);
    const row = rows[rowIndex];
    let error = '';
    if (counts.get(file.name) > 1) error = 'Duplicate design filename. Select only one copy.';
    else if (!overrides.has(index) && matches.length > 1) error = 'Multiple sheet rows match this filename.';
    else if (!row) error = 'No listing selected. Choose its sheet row.';
    else {
      try { validateMetadata(row); } catch (e) { error = e.message; }
    }
    return {file, index, rowIndex, metadata: row, error};
  });
}

export function validateSelection(matches, selectedIndices) {
  if (!selectedIndices.length) throw Error('Select at least one design');
  const used = new Set();
  return selectedIndices.map(index => {
    const match = matches[index];
    if (!match || match.error) throw Error(`${match?.file.name || 'Design'}: ${match?.error || 'missing match'}`);
    if (used.has(match.rowIndex)) throw Error('One sheet row is assigned to multiple selected designs. Choose a separate listing for each.');
    used.add(match.rowIndex);
    return {file: match.file, m: {...match.metadata, filename: match.file.name}};
  });
}

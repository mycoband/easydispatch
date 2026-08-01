'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  PRICEBOOK_IMPORT_TEMPLATE_CSV,
  parsePricebookCsv,
  type ParsedPricebookRow,
} from '@/lib/pricebook/csv-import';
import {
  importPricebookFromCsv,
  type DuplicateMode,
  type ImportPricebookResult,
} from '@/app/dashboard/pricebook/import/actions';
import { formatMoney } from '@/lib/jobs/totals';

function downloadTemplate() {
  const blob = new Blob([PRICEBOOK_IMPORT_TEMPLATE_CSV], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'easydispatch-pricebook-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function PricebookImportPanel() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('update');
  const [result, setResult] = useState<ImportPricebookResult | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => {
    if (!csvText.trim()) return null;
    return parsePricebookCsv(csvText);
  }, [csvText]);

  const validRows = preview?.rows.filter((r) => r.data) ?? [];
  const invalidRows = preview?.rows.filter((r) => !r.data) ?? [];

  async function onFile(file: File | null) {
    setResult(null);
    if (!file) {
      setCsvText('');
      setFileName('');
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setCsvText(text);
  }

  function runImport() {
    if (!csvText.trim()) return;
    setResult(null);
    startTransition(async () => {
      setResult(await importPricebookFromCsv(csvText, duplicateMode));
    });
  }

  return (
    <div className="space-y-6">
      <div className="panel space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-ink-900">
            Import rates from CSV
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Export flat rates from your current FSM or spreadsheet, then upload
            here. Common headers like Item, Price, and Category are mapped
            automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Download template
          </button>
          <label className="cursor-pointer rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {fileName && (
            <span className="self-center text-sm text-ink-500">{fileName}</span>
          )}
        </div>

        <label className="block max-w-md">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">
            If a rate already exists
          </span>
          <select
            value={duplicateMode}
            onChange={(e) => setDuplicateMode(e.target.value as DuplicateMode)}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          >
            <option value="update">Update matching rates (recommended)</option>
            <option value="skip">Skip duplicates</option>
            <option value="create">Create anyway</option>
          </select>
          <p className="mt-1 text-xs text-ink-400">
            Match by name (and category when both match).
          </p>
        </label>

        {preview?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {preview.error}
          </p>
        )}
      </div>

      {preview && !preview.error && (
        <div className="panel space-y-3 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Preview</h2>
              <p className="mt-1 text-sm text-ink-500">
                {validRows.length} ready · {invalidRows.length} with errors
              </p>
            </div>
            <button
              type="button"
              disabled={pending || !validRows.length}
              onClick={runImport}
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? 'Importing…' : `Import ${validRows.length} rates`}
            </button>
          </div>
          <PreviewTable rows={preview.rows.slice(0, 25)} />
          {preview.rows.length > 25 && (
            <p className="text-xs text-ink-400">
              Showing first 25 of {preview.rows.length} rows.
            </p>
          )}
        </div>
      )}

      {result && (
        <div
          className={`panel space-y-2 p-5 ${
            result.error
              ? 'border-red-200 bg-red-50/40'
              : 'border-emerald-200 bg-emerald-50/40'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              result.error ? 'text-red-800' : 'text-emerald-900'
            }`}
          >
            {result.error || result.success}
          </p>
          {result.errors && result.errors.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-ink-600">
              {result.errors.map((e) => (
                <li key={`${e.line}-${e.message}`}>
                  Line {e.line}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewTable({ rows }: { rows: ParsedPricebookRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-100">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink-100 bg-ink-50/80 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-3 py-2 font-medium">Line</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">
              Category
            </th>
            <th className="px-3 py-2 text-right font-medium">Price</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r) => (
            <tr key={r.line}>
              <td className="px-3 py-2 text-ink-400">{r.line}</td>
              <td className="px-3 py-2 font-medium text-ink-900">
                {r.data?.name || '—'}
              </td>
              <td className="hidden px-3 py-2 text-ink-600 sm:table-cell">
                {r.data?.category || '—'}
              </td>
              <td className="px-3 py-2 text-right">
                {r.data ? formatMoney(r.data.unit_price) : '—'}
              </td>
              <td className="px-3 py-2">
                {r.data ? (
                  <span className="text-emerald-700">Ready</span>
                ) : (
                  <span className="text-red-600">{r.error || 'Error'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

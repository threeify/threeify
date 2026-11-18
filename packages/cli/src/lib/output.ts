import type { ListResult } from '@threeify/sdk';
import * as yaml from 'js-yaml';
import type { FormatType } from './args.ts';
import type { Logger } from './logger.ts';

/**
 * Check if data is a ListResult structure (has rows and rowCount)
 */
function isListResult<T>(data: unknown): data is ListResult<T> {
  return (
    typeof data === 'object' &&
    data !== null &&
    'rows' in data &&
    'rowCount' in data &&
    Array.isArray((data as ListResult<unknown>).rows) &&
    typeof (data as ListResult<unknown>).rowCount === 'number'
  );
}

/**
 * Check if data is a plain object (not array, not null)
 */
function isPlainObject(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

/**
 * Format a value for display in table/CSV cells
 */
function formatCellValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
}

/**
 * Escape a CSV field value
 */
function escapeCsvField(value: string): string {
  // If the value contains comma, newline, or double quote, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert data to CSV format
 */
function formatAsCsv<T>(data: T): string {
  // Handle ListResult
  if (isListResult(data)) {
    if (data.rows.length === 0) {
      return '';
    }
    return formatAsCsv(data.rows);
  }

  // Handle arrays
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '';
    }

    // If array of objects, use object keys as headers
    if (data.length > 0 && isPlainObject(data[0])) {
      const firstItem = data[0];
      const headers = Object.keys(firstItem);
      const rows: string[][] = [headers];

      for (const item of data) {
        if (isPlainObject(item)) {
          const row = headers.map((key) => formatCellValue(item[key]));
          rows.push(row);
        }
      }

      return rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
    }

    // Array of primitives
    return data.map((item) => escapeCsvField(formatCellValue(item))).join('\n');
  }

  // Handle single object
  if (isPlainObject(data)) {
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return 'key,value';
    }
    const rows = entries.map(([key, value]) => [key, formatCellValue(value)]);
    return ['key,value', ...rows.map((row) => row.map(escapeCsvField).join(','))].join('\n');
  }

  // Primitive value
  return escapeCsvField(formatCellValue(data));
}

/**
 * Format output based on the specified format
 */
export function formatOutput<T>(data: T, format: FormatType): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'yaml':
      return yaml.dump(data, {
        indent: 2,
        lineWidth: -1, // No line width limit
        noRefs: true, // Prevent circular references
        sortKeys: false, // Preserve key order
      });
    case 'csv':
      return formatAsCsv(data);
    default:
      return JSON.stringify(data, null, 2);
  }
}

/**
 * Format and log output based on the specified format
 */
export function logOutput<T>(data: T, format: FormatType, logger: Logger): void {
  logger.info(formatOutput(data, format));
}

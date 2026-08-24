import React from "react";
import clsx from "@/lib/clsx";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function Table<T>({
  columns,
  data,
  rowKey,
  loading,
  emptyMessage = "Nenhum registro encontrado.",
  onRowClick,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="sticky-header bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  "whitespace-nowrap border-b border-slate-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.align !== "right" && col.align !== "center" && "text-left"
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {loading && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                Carregando...
              </td>
            </tr>
          )}
          {!loading && data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          )}
          {!loading &&
            data.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(onRowClick && "cursor-pointer hover:bg-slate-50")}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      "whitespace-nowrap px-4 py-2.5 text-slate-700",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.className
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

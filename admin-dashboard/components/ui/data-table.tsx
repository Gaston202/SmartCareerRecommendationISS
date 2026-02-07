"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Column<T> {
  header: string;
  accessorKey: keyof T | string;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = "No data available",
  className,
}: DataTableProps<T>) {
  const getCellValue = (row: T, column: Column<T>) => {
    if (column.cell) {
      return column.cell(row);
    }
    
    const keys = String(column.accessorKey).split(".");
    let value: any = row;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  };

  return (
    <div className={cn("overflow-hidden rounded-2xl bg-[#F8F8FA]/95 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]", className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-0 hover:bg-transparent">
            {columns.map((column, index) => (
              <TableHead
                key={index}
                className={cn("h-11 border-0 bg-white/40 px-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]", column.className)}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="h-24 border-0 text-center text-sm text-[#6B7280]"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="border-0 border-b border-white/40 hover:bg-white/50 transition-colors last:border-0">
                {columns.map((column, colIndex) => (
                  <TableCell key={colIndex} className={cn("border-0 px-4 py-3 text-[#1F2937]", column.className)}>
                    {getCellValue(row, column)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

import React from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Column } from "@/components/ui/Table";
import { ImportBatch, ImportBatchError } from "@/types";

interface ImportResultCardProps {
  batch: ImportBatch;
}

export function ImportResultCard({ batch }: ImportResultCardProps) {
  const columns: Column<ImportBatchError>[] = [
    { key: "rowNumber", header: "Linha", render: (r) => r.rowNumber },
    { key: "field", header: "Campo", render: (r) => r.field },
    { key: "message", header: "Mensagem", render: (r) => r.message },
  ];

  return (
    <Card title="Resultado da importação">
      <div className="mb-4 flex flex-wrap gap-3">
        <Badge color="slate">Total: {batch.totalRows}</Badge>
        <Badge color="green">Sucesso: {batch.successRows}</Badge>
        <Badge color="red">Erros: {batch.errorRows}</Badge>
      </div>
      {batch.errors.length > 0 ? (
        <Table columns={columns} data={batch.errors} rowKey={(r) => `${r.rowNumber}-${r.field}`} />
      ) : (
        <p className="text-sm text-emerald-600">Todas as linhas foram importadas com sucesso.</p>
      )}
    </Card>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Table, Column } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { MovementStatusBadge } from "@/components/ui/StatusBadge";
import { DirectorateSelect } from "@/components/shared/Filters";
import { useDirectorates } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  MOVEMENT_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  MovementRequest,
  Paginated,
} from "@/types";

export default function MovementsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { directorates } = useDirectorates();

  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [directorateId, setDirectorateId] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [movements, setMovements] = useState<MovementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<Paginated<MovementRequest>>("/movements", {
        status: status || undefined,
        type: type || undefined,
        directorateId: directorateId || undefined,
        page,
        limit,
      })
      .then((res) => {
        if (!active) return;
        setMovements(res.items ?? []);
        setTotal(res.total ?? 0);
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type, directorateId, page]);

  const columns: Column<MovementRequest>[] = [
    { key: "type", header: "Tipo", render: (r) => MOVEMENT_TYPE_LABELS[r.type] ?? r.type },
    { key: "employee", header: "Colaborador", render: (r) => r.employeeName ?? "—" },
    { key: "directorate", header: "Diretoria", render: (r) => r.directorateName ?? r.destinationDirectorateName ?? "—" },
    {
      key: "value",
      header: "Novo Salário / Impacto",
      render: (r) => formatCurrency(r.newSalary ?? r.plannedSalary),
      align: "right",
    },
    { key: "effectiveDate", header: "Data Efetiva", render: (r) => formatDate(r.effectiveDate) },
    { key: "status", header: "Status", render: (r) => <MovementStatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Movimentações</h1>
          <p className="text-sm text-brand-text">Solicitações de promoção, mérito, transferência e aumento de quadro.</p>
        </div>
        <Link href="/movements/new">
          <Button>Nova movimentação</Button>
        </Link>
      </div>

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Status"
            placeholder="Todos"
            options={Object.entries(MOVEMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Tipo"
            placeholder="Todos"
            options={Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          />
          <DirectorateSelect
            value={directorateId}
            onChange={(v) => {
              setDirectorateId(v);
              setPage(1);
            }}
            directorates={directorates}
          />
        </div>
        <Table
          columns={columns}
          data={movements}
          rowKey={(r) => r.id}
          loading={loading}
          onRowClick={(r) => router.push(`/movements/${r.id}`)}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}

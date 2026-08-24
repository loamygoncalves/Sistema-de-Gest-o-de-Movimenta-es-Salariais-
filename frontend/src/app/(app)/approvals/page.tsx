"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { Table, Column } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { MOVEMENT_TYPE_LABELS, PendingApproval } from "@/types";

export default function ApprovalsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalStep, setModalStep] = useState<{ step: PendingApproval; action: "approve" | "reject" } | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PendingApproval[]>("/approvals/pending");
      setPending(res ?? []);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConfirm() {
    if (!modalStep) return;
    if (modalStep.action === "reject" && !comment.trim()) {
      showToast("Informe um comentário para reprovar a movimentação.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/approvals/${modalStep.step.id}/${modalStep.action}`, {
        comment: comment.trim() || undefined,
      });
      showToast(
        modalStep.action === "approve" ? "Movimentação aprovada." : "Movimentação reprovada.",
        "success"
      );
      setModalStep(null);
      setComment("");
      load();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<PendingApproval>[] = [
    { key: "type", header: "Tipo", render: (r) => MOVEMENT_TYPE_LABELS[r.movementType as keyof typeof MOVEMENT_TYPE_LABELS] ?? r.movementType },
    { key: "employee", header: "Colaborador", render: (r) => r.employeeName ?? "—" },
    { key: "directorate", header: "Diretoria", render: (r) => r.directorateName ?? "—" },
    {
      key: "impact",
      header: "Impacto Anual",
      render: (r) => (r.totalAnnualImpact != null ? formatCurrency(r.totalAnnualImpact) : "—"),
      align: "right",
    },
    { key: "effectiveDate", header: "Data Efetiva", render: (r) => formatDate(r.effectiveDate) },
    {
      key: "actions",
      header: "Ações",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push(`/movements/${r.movementId}`)}>
            Detalhes
          </Button>
          <Button size="sm" variant="danger" onClick={() => setModalStep({ step: r, action: "reject" })}>
            Reprovar
          </Button>
          <Button size="sm" onClick={() => setModalStep({ step: r, action: "approve" })}>
            Aprovar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Minhas Pendências</h1>
        <p className="text-sm text-slate-500">Movimentações aguardando sua aprovação.</p>
      </div>

      <Card>
        {!loading && pending.length === 0 ? (
          <EmptyState title="Nenhuma pendência" description="Você não tem movimentações aguardando aprovação no momento." />
        ) : (
          <Table columns={columns} data={pending} rowKey={(r) => r.id} loading={loading} />
        )}
      </Card>

      <Modal
        open={!!modalStep}
        onClose={() => setModalStep(null)}
        title={modalStep?.action === "approve" ? "Aprovar movimentação" : "Reprovar movimentação"}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalStep(null)}>
              Cancelar
            </Button>
            <Button
              variant={modalStep?.action === "reject" ? "danger" : "primary"}
              onClick={handleConfirm}
              loading={submitting}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <Textarea
          label="Comentário"
          required={modalStep?.action === "reject"}
          placeholder={
            modalStep?.action === "reject"
              ? "Explique o motivo da reprovação..."
              : "Comentário opcional..."
          }
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Modal>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Table, Column } from "@/components/ui/Table";
import { useCrudResource } from "@/hooks/useCrudResource";
import { useDirectorates } from "@/hooks/useOrgOptions";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { CreateUserPayload, ROLE_LABELS, Role, User } from "@/types";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

export default function UsersAdminPage() {
  return (
    <RoleGuard roles={["ADMIN"]}>
      <UsersAdminContent />
    </RoleGuard>
  );
}

function UsersAdminContent() {
  const { items: users, loading, create, update } = useCrudResource<User>("/users");
  const { directorates } = useDirectorates();
  const { showToast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<Partial<CreateUserPayload>>({ role: "GESTOR" });
  const [creating, setCreating] = useState(false);

  const [editUser, setEditUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!createForm.name || !createForm.email || !createForm.password || !createForm.role) {
      showToast("Preencha nome, e-mail, senha e perfil.", "error");
      return;
    }
    setCreating(true);
    try {
      await create(createForm as CreateUserPayload);
      showToast("Usuário criado com sucesso.", "success");
      setCreateOpen(false);
      setCreateForm({ role: "GESTOR" });
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit() {
    if (!editUser) return;
    setSaving(true);
    try {
      await update(editUser.id, {
        role: editUser.role,
        directorateId: editUser.directorateId,
        active: editUser.active,
      });
      showToast("Usuário atualizado com sucesso.", "success");
      setEditUser(null);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(user: User) {
    try {
      await update(user.id, { active: !user.active });
      showToast(user.active ? "Usuário desativado." : "Usuário reativado.", "success");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  }

  const columns: Column<User>[] = [
    { key: "name", header: "Nome", render: (r) => r.name },
    { key: "email", header: "E-mail", render: (r) => r.email },
    { key: "role", header: "Perfil", render: (r) => <Badge color="teal">{ROLE_LABELS[r.role]}</Badge> },
    { key: "directorate", header: "Diretoria", render: (r) => r.directorateName ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge color={r.active ? "green" : "slate"}>{r.active ? "Ativo" : "Inativo"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditUser(r)}>
            Editar
          </Button>
          <Button size="sm" variant={r.active ? "danger" : "secondary"} onClick={() => handleToggleActive(r)}>
            {r.active ? "Desativar" : "Reativar"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Usuários</h1>
          <p className="text-sm text-brand-text">Gestão de acessos e perfis do sistema.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Novo usuário</Button>
      </div>

      <Card>
        <Table columns={columns} data={users} rowKey={(r) => r.id} loading={loading} />
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo usuário"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={creating}>Criar usuário</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Nome" required value={createForm.name ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="E-mail" type="email" required value={createForm.email ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Senha provisória" type="password" required value={createForm.password ?? ""} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
          <Select
            label="Perfil"
            required
            options={ROLE_OPTIONS}
            value={createForm.role ?? "GESTOR"}
            onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as Role }))}
          />
          {(createForm.role === "DIRETOR" || createForm.role === "GESTOR") && (
            <Select
              label="Diretoria"
              required
              placeholder="Selecione"
              options={directorates.map((d) => ({ value: d.id, label: d.name }))}
              value={createForm.directorateId ?? ""}
              onChange={(e) => setCreateForm((f) => ({ ...f, directorateId: e.target.value }))}
            />
          )}
        </div>
      </Modal>

      <Modal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title="Editar usuário"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} loading={saving}>Salvar</Button>
          </>
        }
      >
        {editUser && (
          <div className="flex flex-col gap-4">
            <Input label="Nome" value={editUser.name} disabled />
            <Input label="E-mail" value={editUser.email} disabled />
            <Select
              label="Perfil"
              options={ROLE_OPTIONS}
              value={editUser.role}
              onChange={(e) => setEditUser((u) => (u ? { ...u, role: e.target.value as Role } : u))}
            />
            {(editUser.role === "DIRETOR" || editUser.role === "GESTOR") && (
              <Select
                label="Diretoria"
                placeholder="Selecione"
                options={directorates.map((d) => ({ value: d.id, label: d.name }))}
                value={editUser.directorateId ?? ""}
                onChange={(e) => setEditUser((u) => (u ? { ...u, directorateId: e.target.value } : u))}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

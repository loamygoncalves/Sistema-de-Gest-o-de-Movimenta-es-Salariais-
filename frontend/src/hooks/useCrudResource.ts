"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface WithId {
  id: string;
}

function normalizeList<T>(res: T[] | { items: T[] }): T[] {
  return Array.isArray(res) ? res : res.items ?? [];
}

/**
 * Small generic helper around a REST-ish CRUD path (list/create/update/
 * delete) used by the admin org-structure, users, and charge-parameter
 * screens. Accepts either a bare array or `{ data: [...] }` response for the
 * list endpoint (see the note in useOrgOptions.ts on why).
 */
export function useCrudResource<T extends WithId>(path: string, params?: Record<string, unknown>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<T[] | { items: T[] }>(path, params);
      setItems(normalizeList(res));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, JSON.stringify(params ?? {})]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(payload: Partial<T>): Promise<T> {
    const created = await api.post<T>(path, payload);
    await load();
    return created;
  }

  async function update(id: string, payload: Partial<T>): Promise<T> {
    const updated = await api.patch<T>(`${path}/${id}`, payload);
    await load();
    return updated;
  }

  async function remove(id: string): Promise<void> {
    await api.delete(`${path}/${id}`);
    await load();
  }

  return { items, loading, reload: load, create, update, remove };
}

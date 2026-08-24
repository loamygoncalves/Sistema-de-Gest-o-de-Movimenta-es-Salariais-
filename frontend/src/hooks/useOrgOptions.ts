"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CostCenter, Directorate, Management, Position } from "@/types";

// Fetches org-structure reference lists used to populate filter/select
// dropdowns across several screens. The contract doesn't document a
// pagination envelope for these simple catalog endpoints, so we accept
// either a bare array or a `{ data: [...] }` envelope — a defensive
// judgment call, since GET /directorates etc. read-only lists are more
// likely to return an unpaginated array in practice.
function normalizeList<T>(res: T[] | { data: T[] }): T[] {
  return Array.isArray(res) ? res : res.data ?? [];
}

export function useDirectorates() {
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get<Directorate[] | { data: Directorate[] }>("/directorates")
      .then((res) => {
        if (active) setDirectorates(normalizeList(res));
      })
      .catch(() => {
        if (active) setDirectorates([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { directorates, loading };
}

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get<Position[] | { data: Position[] }>("/positions")
      .then((res) => {
        if (active) setPositions(normalizeList(res));
      })
      .catch(() => {
        if (active) setPositions([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { positions, loading };
}

export function useCostCenters() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get<CostCenter[] | { data: CostCenter[] }>("/cost-centers")
      .then((res) => {
        if (active) setCostCenters(normalizeList(res));
      })
      .catch(() => {
        if (active) setCostCenters([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { costCenters, loading };
}

export function useManagements(directorateId?: string) {
  const [managements, setManagements] = useState<Management[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<Management[] | { data: Management[] }>("/managements", { directorateId })
      .then((res) => {
        if (active) setManagements(normalizeList(res));
      })
      .catch(() => {
        if (active) setManagements([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [directorateId]);

  return { managements, loading };
}

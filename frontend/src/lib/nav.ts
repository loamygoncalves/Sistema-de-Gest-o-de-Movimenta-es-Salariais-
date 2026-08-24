import { Role } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  roles?: Role[]; // when omitted, visible to every authenticated role
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Visão Geral",
    items: [{ label: "Dashboard Executivo", href: "/dashboard" }],
  },
  {
    title: "Orçamento & Quadro",
    items: [
      { label: "Orçamento", href: "/budget", roles: ["ADMIN", "RH_REMUNERACAO", "FINANCEIRO", "DIRETOR"] },
      { label: "Colaboradores", href: "/employees" },
    ],
  },
  {
    title: "Movimentações",
    items: [
      { label: "Movimentações", href: "/movements" },
      { label: "Aprovações", href: "/approvals", roles: ["ADMIN", "DIRETOR", "FINANCEIRO", "RH_REMUNERACAO"] },
      { label: "Histórico", href: "/history" },
    ],
  },
  {
    title: "Mercado",
    items: [
      { label: "Estudos Salariais", href: "/salary-studies", roles: ["ADMIN", "RH_REMUNERACAO", "DIRETOR", "FINANCEIRO"] },
    ],
  },
  {
    title: "Administração",
    items: [
      { label: "Estrutura Organizacional", href: "/admin/organization", roles: ["ADMIN", "RH_REMUNERACAO"] },
      { label: "Usuários", href: "/admin/users", roles: ["ADMIN"] },
      { label: "Encargos & Benefícios", href: "/admin/charge-parameters", roles: ["ADMIN", "RH_REMUNERACAO"] },
    ],
  },
];

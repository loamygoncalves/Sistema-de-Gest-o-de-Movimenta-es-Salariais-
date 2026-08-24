import { MovementSimulation } from "@/types/movement";

// The backend returns full nested relation objects (e.g. `position: {id,
// name}`, `directorate: {id, name}`) instead of the flat `positionName` /
// `directorateName` fields the UI types assume. Rather than rewrite every
// render function in every screen, we flatten known relations into those
// sibling `${key}Name` fields right after parsing the response, so both
// shapes are available and existing screens keep working unmodified.
const RELATION_ALIASES: Record<string, string[]> = {
  // MovementRequest uses `positionId`/`positionName` for what the backend
  // calls the movement's `currentPosition` relation.
  currentPosition: ["position"],
  // ApprovalStep/history screens read `approverName`, not `approverUserName`.
  approverUser: ["approver"],
};

export function flattenRelations<T>(node: T): T {
  if (Array.isArray(node)) {
    node.forEach((item) => flattenRelations(item));
    return node;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const nested = value as Record<string, unknown>;
        if (typeof nested.name === "string") {
          const targets = [key, ...(RELATION_ALIASES[key] ?? [])];
          for (const target of targets) {
            const nameKey = `${target}Name`;
            if (obj[nameKey] === undefined) obj[nameKey] = nested.name;
            if (target !== key && obj[`${target}Id`] === undefined && typeof nested.id === "string") {
              obj[`${target}Id`] = nested.id;
            }
          }
        }
        flattenRelations(value);
      } else if (Array.isArray(value)) {
        flattenRelations(value);
      }
    }
  }
  return node;
}

// Maps the backend's flat MovementSimulation response
// (monthlySalaryImpact/.../budgetedDirectoratePayroll/currentDirectoratePayroll/
// payrollAfterApproval/difference/percentConsumed) to the nested
// `{ budget: { budgeted, current, afterApproval, difference, percentConsumed } }`
// shape the simulator screen renders.
export function normalizeSimulation(raw: any): MovementSimulation {
  return {
    monthlySalaryImpact: raw.monthlySalaryImpact,
    annualSalaryImpact: raw.annualSalaryImpact,
    chargesTotal: raw.chargesTotal,
    benefitsTotal: raw.benefitsTotal,
    totalMonthlyImpact: raw.totalMonthlyImpact,
    totalAnnualImpact: raw.totalAnnualImpact,
    exceedsBudget: raw.exceedsBudget,
    alertMessage: raw.alertMessage,
    budget: {
      budgeted: raw.budgetedDirectoratePayroll,
      current: raw.currentDirectoratePayroll,
      afterApproval: raw.payrollAfterApproval,
      difference: raw.difference,
      percentConsumed: raw.percentConsumed,
    },
    chargesBreakdown: raw.chargesBreakdown,
    benefitsBreakdown: raw.benefitsBreakdown,
  };
}

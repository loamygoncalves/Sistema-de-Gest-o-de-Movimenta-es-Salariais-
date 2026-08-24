import { ChargeParameterCategory, ChargeParameterType } from "./enums";

export interface ChargeParameter {
  id: string;
  name: string;
  category: ChargeParameterCategory;
  type: ChargeParameterType;
  value: number;
  active: boolean;
  createdAt?: string;
}

export interface UpsertChargeParameterPayload {
  name: string;
  category: ChargeParameterCategory;
  type: ChargeParameterType;
  value: number;
  active?: boolean;
}

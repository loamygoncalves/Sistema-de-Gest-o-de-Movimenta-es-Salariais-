import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, ValidateNested } from 'class-validator';
import { ApproverRole } from '../../../common/enums';

export class ApprovalWorkflowStepDto {
  /** Qualquer um destes perfis decide a etapa — o que agir primeiro. */
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ApproverRole, { each: true })
  roles: ApproverRole[];
}

/** PUT /approval-workflow — substitui o fluxo inteiro; a ordem no array define stepOrder. */
export class SaveApprovalWorkflowDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApprovalWorkflowStepDto)
  steps: ApprovalWorkflowStepDto[];
}

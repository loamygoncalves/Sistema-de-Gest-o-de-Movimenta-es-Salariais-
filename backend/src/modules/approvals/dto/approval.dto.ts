import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DecideApprovalDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

/** `comment` é o motivo da devolução — obrigatório e não-vazio, é o que o solicitante vê (ver ApprovalsService#reject). */
export class RejectApprovalDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da recusa.' })
  comment: string;
}

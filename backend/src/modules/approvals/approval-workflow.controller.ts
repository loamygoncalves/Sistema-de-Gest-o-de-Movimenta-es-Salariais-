import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { SaveApprovalWorkflowDto } from './dto/approval-workflow.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('approval-workflow')
export class ApprovalWorkflowController {
  constructor(private readonly service: ApprovalWorkflowService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Put()
  @Roles(UserRole.ADMIN)
  replace(@Body() dto: SaveApprovalWorkflowDto) {
    return this.service.replace(dto.steps);
  }
}

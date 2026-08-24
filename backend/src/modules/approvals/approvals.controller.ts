import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApprovalsService } from './approvals.service';
import { DecideApprovalDto, RejectApprovalDto } from './dto/approval.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('pending')
  findPending(@CurrentUser() user: AuthenticatedUser) {
    return this.approvalsService.findPending(user);
  }

  @Get('movement/:movementId')
  findTimeline(@Param('movementId') movementId: string) {
    return this.approvalsService.findTimeline(movementId);
  }

  @Post(':stepId/approve')
  approve(
    @Param('stepId') stepId: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalsService.approve(stepId, user, dto.comment);
  }

  @Post(':stepId/reject')
  reject(
    @Param('stepId') stepId: string,
    @Body() dto: RejectApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalsService.reject(stepId, user, dto.comment);
  }
}

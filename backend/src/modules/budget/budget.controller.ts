import {
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
  isScopedToOwnDirectorate,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { BudgetService } from './budget.service';
import { BudgetDashboardQueryDto, BudgetEntryQueryDto } from './dto/budget.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('budget')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get('entries')
  findEntries(@Query() query: BudgetEntryQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetService.findEntries(
      query,
      isScopedToOwnDirectorate(user) ? user.directorateId ?? undefined : undefined,
    );
  }

  @Get('dashboard')
  getDashboard(@Query() query: BudgetDashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetService.getDashboard(
      query.year,
      isScopedToOwnDirectorate(user) ? user.directorateId ?? undefined : query.directorateId,
    );
  }

  @Post('import')
  @Roles(UserRole.ADMIN, UserRole.RH_REMUNERACAO)
  @UseInterceptors(FileInterceptor('file'))
  importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Query('year') year: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgetService.importFromExcel(
      file.buffer,
      file.originalname,
      parseInt(year, 10) || new Date().getFullYear(),
      user.id,
    );
  }
}

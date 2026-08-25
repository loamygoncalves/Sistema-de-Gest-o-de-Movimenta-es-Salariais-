import {
  Body,
  Controller,
  Get,
  Param,
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
  resolveAccessScope,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { SalaryStudiesService } from './salary-studies.service';
import { ImportSalaryStudyDto, PositioningQueryDto } from './dto/salary-study.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salary-studies')
export class SalaryStudiesController {
  constructor(private readonly salaryStudiesService: SalaryStudiesService) {}

  @Get()
  findAll() {
    return this.salaryStudiesService.findAll();
  }

  @Get('positioning')
  getPositioning(@Query() query: PositioningQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salaryStudiesService.getPositioning(query, resolveAccessScope(user));
  }

  @Get(':id/entries')
  findEntries(@Param('id') id: string) {
    return this.salaryStudiesService.findEntries(id);
  }

  @Post('import')
  @Roles(UserRole.ADMIN, UserRole.RH_REMUNERACAO)
  @UseInterceptors(FileInterceptor('file'))
  importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportSalaryStudyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salaryStudiesService.importFromExcel(file.buffer, file.originalname, dto, user.id);
  }
}

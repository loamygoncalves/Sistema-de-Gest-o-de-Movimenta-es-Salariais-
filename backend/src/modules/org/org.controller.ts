import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { OrgService } from './org.service';
import {
  CreateCoordinationDto,
  CreateCostCenterDto,
  CreateDirectorateDto,
  CreateManagementDto,
  CreatePositionDto,
  UpdateDirectorateDto,
  UpdatePositionDto,
} from './dto/org.dto';

const MANAGE_ROLES = [UserRole.ADMIN, UserRole.RH_REMUNERACAO];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Get('directorates')
  findAllDirectorates() {
    return this.orgService.findAllDirectorates();
  }

  @Get('directorates/:id')
  findDirectorate(@Param('id') id: string) {
    return this.orgService.findDirectorate(id);
  }

  @Post('directorates')
  @Roles(...MANAGE_ROLES)
  createDirectorate(@Body() dto: CreateDirectorateDto) {
    return this.orgService.createDirectorate(dto);
  }

  @Patch('directorates/:id')
  @Roles(...MANAGE_ROLES)
  updateDirectorate(@Param('id') id: string, @Body() dto: UpdateDirectorateDto) {
    return this.orgService.updateDirectorate(id, dto);
  }

  @Delete('directorates/:id')
  @Roles(UserRole.ADMIN)
  removeDirectorate(@Param('id') id: string) {
    return this.orgService.removeDirectorate(id);
  }

  @Get('managements')
  findManagements(@Query('directorateId') directorateId?: string) {
    return this.orgService.findManagements(directorateId);
  }

  @Post('managements')
  @Roles(...MANAGE_ROLES)
  createManagement(@Body() dto: CreateManagementDto) {
    return this.orgService.createManagement(dto);
  }

  @Get('coordinations')
  findCoordinations(@Query('managementId') managementId?: string) {
    return this.orgService.findCoordinations(managementId);
  }

  @Post('coordinations')
  @Roles(...MANAGE_ROLES)
  createCoordination(@Body() dto: CreateCoordinationDto) {
    return this.orgService.createCoordination(dto);
  }

  @Get('positions')
  findAllPositions() {
    return this.orgService.findAllPositions();
  }

  @Post('positions')
  @Roles(...MANAGE_ROLES)
  createPosition(@Body() dto: CreatePositionDto) {
    return this.orgService.createPosition(dto);
  }

  @Patch('positions/:id')
  @Roles(...MANAGE_ROLES)
  updatePosition(@Param('id') id: string, @Body() dto: UpdatePositionDto) {
    return this.orgService.updatePosition(id, dto);
  }

  @Delete('positions/:id')
  @Roles(...MANAGE_ROLES)
  removePosition(@Param('id') id: string) {
    return this.orgService.removePosition(id);
  }

  @Get('cost-centers')
  findAllCostCenters() {
    return this.orgService.findAllCostCenters();
  }

  @Post('cost-centers')
  @Roles(...MANAGE_ROLES)
  createCostCenter(@Body() dto: CreateCostCenterDto) {
    return this.orgService.createCostCenter(dto);
  }

  @Post('cost-centers/import')
  @Roles(...MANAGE_ROLES)
  @UseInterceptors(FileInterceptor('file'))
  importCostCenters(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orgService.importCostCentersFromExcel(file.buffer, file.originalname, user.id);
  }

  @Get('cost-centers/import/:batchId')
  @Roles(...MANAGE_ROLES)
  getCostCenterImportBatch(@Param('batchId') batchId: string) {
    return this.orgService.getCostCenterImportBatch(batchId);
  }
}

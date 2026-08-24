import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async log(params: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    before?: Record<string, any>;
    after?: Record<string, any>;
  }): Promise<void> {
    await this.repo.save(this.repo.create(params));
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import schedulingConfig from '../config/scheduling.config.js';
import { Appointment } from './appointment.entity.js';
import { AppointmentsController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forFeature(schedulingConfig),
    TypeOrmModule.forFeature([Appointment])
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}

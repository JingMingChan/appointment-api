import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { DateQueryDto } from './dto/date-query.dto.js';

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get('available-slots')
  @ApiOperation({ summary: 'List slots and remaining availability for a date' })
  availableSlots(@Query() { date }: DateQueryDto) {
    return this.service.getAvailableSlots(date);
  }

  @Get(':id')
  @ApiOperation({ summary: 'View one appointment' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Book an appointment (1..MAX_SLOTS_PER_APPOINTMENT consecutive slots)' })
  book(@Body() dto: CreateAppointmentDto) {
    return this.service.book(dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel an appointment and release its slots' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SCHEDULING_CONFIG_KEY, SchedulingConfig } from '../config/scheduling.config.js';
import { Appointment, AppointmentStatus } from './appointment.entity.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';

export interface SlotAvailability {
  date: string;
  time: string;
  available_slots: number;
}

const toHHmm = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

@Injectable()
export class AppointmentsService {
  private readonly cfg: SchedulingConfig;

  constructor(
    @InjectRepository(Appointment) private readonly repo: Repository<Appointment>,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.cfg = config.getOrThrow<SchedulingConfig>(SCHEDULING_CONFIG_KEY);
  }

  /** GET available slots for a date. Returns [] on non-operating days. */
  async getAvailableSlots(date: string): Promise<SlotAvailability[]> {
    if (!this.isOperatingDay(date)) return [];

    const booked = await this.repo.find({ where: { date: date, status: AppointmentStatus.BOOKED } });
    const { slotDurationMinutes: dur, openMinute, closeMinute, slotCapacity } = this.cfg;
    const result: SlotAvailability[] = [];

    for (let s = openMinute; s + dur <= closeMinute; s += dur) {
      const used = this.countOverlap(booked, s, s + dur);
      const free = this.isPast(date, s) ? 0 : Math.max(slotCapacity - used, 0);
      result.push({ date, time: toHHmm(s), available_slots: free });
    }
    return result;
  }

  /** Book an appointment covering `slots` consecutive slots starting at `time`. */
  async book(dto: CreateAppointmentDto): Promise<Appointment> {
    const { slotDurationMinutes: dur, openMinute, closeMinute, slotCapacity, maxSlotsPerAppointment } = this.cfg;
    const slots = dto.slots ?? 1;

    if (!this.isOperatingDay(dto.date))
      throw new BadRequestException(`Appointments are not available on ${dto.date}`);
    if (slots > maxSlotsPerAppointment)
      throw new BadRequestException(`An appointment can have at most ${maxSlotsPerAppointment} slot(s)`);

    const [h, m] = dto.time.split(':').map(Number);
    const start = h * 60 + m;
    const end = start + slots * dur;

    if (start < openMinute || (start - openMinute) % dur !== 0)
      throw new BadRequestException(
        `time must align to a ${dur}-minute slot starting at ${toHHmm(openMinute)}`,
      );
    if (end > closeMinute)
      throw new BadRequestException(`Appointment would end after closing time (${toHHmm(closeMinute)})`);
    if (this.isPast(dto.date, start)) throw new BadRequestException('Cannot book a slot in the past');

    // The transaction + per-date advisory lock serialises concurrent bookings for the
    // same day, so two requests can never both pass the availability check (no double booking).
    return this.dataSource.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [dto.date]);

      const booked = await em.find(Appointment, { where: { date: dto.date, status: AppointmentStatus.BOOKED } });
      for (let s = start; s < end; s += dur) {
        if (this.countOverlap(booked, s, s + dur) >= slotCapacity)
          throw new ConflictException(`Slot ${toHHmm(s)} on ${dto.date} is no longer available`);
      }

      return em.save(
        em.create(Appointment, {
          date: dto.date,
          startMinute: start,
          endMinute: end,
          slots,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
        }),
      );
    });
  }

  /** Cancel = mark as CANCELLED, which frees the slots (availability only counts BOOKED). */
  async cancel(id: string): Promise<Appointment> {
    const appt = await this.findOne(id);
    if (appt.status === AppointmentStatus.CANCELLED)
      throw new ConflictException('Appointment is already cancelled');
    appt.status = AppointmentStatus.CANCELLED;
    appt.cancelledAt = new Date();
    return this.repo.save(appt);
  }

  async findOne(id: string): Promise<Appointment> {
    const appt = await this.repo.findOne({ where: { id } });
    if (!appt) throw new NotFoundException(`Appointment ${id} not found`);
    return appt;
  }

  // ---------- helpers ----------

  /** Validates a YYYY-MM-DD calendar date and checks it against OPERATING_DAYS. */
  private isOperatingDay(date: string): boolean {
    const d = new Date(`${date}T00:00:00Z`);
    if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date)
      throw new BadRequestException(`"${date}" is not a valid calendar date`);
    return this.cfg.operatingDays.includes(d.getUTCDay());
  }

  private countOverlap(booked: Appointment[], start: number, end: number): number {
    return booked.filter((a) => a.startMinute < end && a.endMinute > start).length;
  }

  /** Uses server local time. */
  private isPast(date: string, startMinute: number): boolean {
    const [y, mo, d] = date.split('-').map(Number);
    return new Date(y, mo - 1, d, 0, startMinute).getTime() < Date.now();
  }
}

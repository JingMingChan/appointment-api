import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum AppointmentStatus {
  BOOKED = 'BOOKED',
  CANCELLED = 'CANCELLED',
}

/**
 * Single-table design. An appointment may span several consecutive slots.
 * Start/end are stored as minutes-since-midnight so existing bookings stay
 * valid even if SLOT_DURATION_MINUTES is changed later.
 */
@Entity('appointments')
@Index(['date', 'status'])
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string; // YYYY-MM-DD

  @Column({ type: 'int' })
  startMinute: number;

  @Column({ type: 'int' })
  endMinute: number; // exclusive

  @Column({ type: 'int', default: 1 })
  slots: number;

  @Column({ length: 100 })
  customerName: string;

  @Column({ length: 255 })
  customerEmail: string;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.BOOKED })
  status: AppointmentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({ example: '2025-10-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ example: '10:00', description: 'Slot start time (HH:mm)' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be in HH:mm format' })
  time: string;

  @ApiPropertyOptional({ example: 1, description: 'Consecutive slots to book (1-5, capped by MAX_SLOTS_PER_APPOINTMENT)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  slots?: number;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerName: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(255)
  customerEmail: string;
}

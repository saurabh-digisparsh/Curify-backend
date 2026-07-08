import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

/** Free-typed "Other" treatment from the intake chat. The global ValidationPipe
 *  runs whitelist + forbidNonWhitelisted, so `text` must be declared here. */
export class ClassifyTreatmentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  text: string;
}

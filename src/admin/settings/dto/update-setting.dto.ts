import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class UpdateSettingDto {
  // @Allow() whitelists the property for the global ValidationPipe (whitelist +
  // forbidNonWhitelisted) without constraining its type — the value may be a
  // string, number or boolean depending on the setting; SettingsService validates
  // and normalizes it per the setting's declared type.
  @Allow()
  @ApiProperty({
    description: 'New value for the setting (string, number or boolean depending on the setting type).',
    oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
  })
  value: string | number | boolean;
}

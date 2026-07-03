import { Request } from 'express';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
export declare class AdminSettingsController {
    private readonly settings;
    constructor(settings: SettingsService);
    list(): Promise<import("./settings.service").SettingsGroup[]>;
    update(key: string, dto: UpdateSettingDto, req: Request): Promise<import("./settings.service").SettingView>;
    reset(key: string): Promise<import("./settings.service").SettingView>;
}

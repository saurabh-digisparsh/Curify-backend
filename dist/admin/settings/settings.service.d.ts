import { PrismaService } from '../../prisma/prisma.service';
import { SettingDef, SettingCategory } from './settings.registry';
type Source = 'override' | 'env' | 'default';
export interface SettingView {
    key: string;
    label: string;
    description: string;
    category: SettingCategory;
    type: SettingDef['type'];
    secret: boolean;
    readOnly: boolean;
    min?: number;
    max?: number;
    source: Source;
    isOverridden: boolean;
    value?: string | number | boolean;
    isSet?: boolean;
    masked?: string;
}
export interface SettingsGroup {
    category: SettingCategory;
    label: string;
    description: string;
    settings: SettingView[];
}
export declare class SettingsService {
    private prisma;
    constructor(prisma: PrismaService);
    private overrides;
    private resolve;
    private coerce;
    private toView;
    list(): Promise<SettingsGroup[]>;
    private normalize;
    update(key: string, value: unknown, updatedBy?: string): Promise<SettingView>;
    reset(key: string): Promise<SettingView>;
    get(key: string): Promise<string>;
    getNumber(key: string): Promise<number>;
    getBool(key: string): Promise<boolean>;
}
export {};

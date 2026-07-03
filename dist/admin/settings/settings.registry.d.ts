export type SettingType = 'string' | 'int' | 'float' | 'boolean';
export type SettingCategory = 'integrations' | 'leadgen' | 'scheduling' | 'system';
export interface SettingDef {
    key: string;
    label: string;
    description: string;
    category: SettingCategory;
    type: SettingType;
    default: string;
    env?: string;
    secret?: boolean;
    readOnly?: boolean;
    min?: number;
    max?: number;
}
export declare const CATEGORY_META: Record<SettingCategory, {
    label: string;
    description: string;
}>;
export declare const SETTINGS_REGISTRY: SettingDef[];
export declare const SETTINGS_BY_KEY: Record<string, SettingDef>;

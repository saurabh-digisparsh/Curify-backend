"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSettingDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class UpdateSettingDto {
}
exports.UpdateSettingDto = UpdateSettingDto;
__decorate([
    (0, class_validator_1.Allow)(),
    (0, swagger_1.ApiProperty)({
        description: 'New value for the setting (string, number or boolean depending on the setting type).',
        oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
    }),
    __metadata("design:type", Object)
], UpdateSettingDto.prototype, "value", void 0);
//# sourceMappingURL=update-setting.dto.js.map
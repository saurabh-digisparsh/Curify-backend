import { Role } from '@prisma/client';
export declare class CreateUserDto {
    email: string;
    password: string;
    role: Role;
    name?: string;
    country?: string;
    phone?: string;
}

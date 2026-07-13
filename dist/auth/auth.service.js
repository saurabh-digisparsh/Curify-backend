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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const mail_service_1 = require("./mail.service");
const inquiries_service_1 = require("../inquiries/inquiries.service");
let AuthService = class AuthService {
    constructor(prisma, jwt, mail, inquiries) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.mail = mail;
        this.inquiries = inquiries;
    }
    async issueOtp(user) {
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const verifyToken = (0, crypto_1.randomBytes)(32).toString('hex');
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                verifyOtp: otp,
                verifyOtpExp: new Date(Date.now() + 10 * 60 * 1000),
                verifyOtpTries: 0,
                verifyToken,
                verifyTokenExp: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
        await this.mail.sendOtp(user.email, user.name, otp, verifyToken);
    }
    async signup(dto) {
        const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (exists)
            throw new common_1.ConflictException('Email already registered');
        const hashed = await bcrypt.hash(dto.password, 12);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                name: dto.name,
                password: hashed,
                country: dto.country,
                phone: dto.phone,
                medicalConsentAt: dto.medicalConsent ? new Date() : null,
            },
        });
        await this.issueOtp(user);
        return { requiresVerification: true, email: user.email, message: 'Verification code sent — check your inbox.' };
    }
    async verifyOtp(email, otp) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user || !user.verifyOtp || !user.verifyOtpExp) {
            throw new common_1.BadRequestException('No verification pending for this email. Request a new code.');
        }
        if (user.verifyOtpExp < new Date()) {
            throw new common_1.BadRequestException('This code has expired — request a new one.');
        }
        if (user.verifyOtpTries >= 6) {
            throw new common_1.BadRequestException('Too many attempts — request a new code.');
        }
        if (String(otp).trim() !== user.verifyOtp) {
            await this.prisma.user.update({ where: { id: user.id }, data: { verifyOtpTries: { increment: 1 } } });
            throw new common_1.BadRequestException('Incorrect code — please try again.');
        }
        const verified = await this.prisma.user.update({
            where: { id: user.id },
            data: { emailVerifiedAt: new Date(), verifyOtp: null, verifyOtpExp: null, verifyToken: null, verifyTokenExp: null },
        });
        await this.inquiries.markConverted(verified.email, verified.id).catch(() => { });
        const { password, ...userData } = verified;
        return { user: userData, token: this.signToken(verified.id, verified.email), verified: true };
    }
    async verifyEmail(token) {
        if (!token || token.length < 32)
            throw new common_1.BadRequestException('Invalid verification link');
        const user = await this.prisma.user.findUnique({ where: { verifyToken: token } });
        if (!user)
            throw new common_1.BadRequestException('This verification link is invalid or was already used.');
        if (user.verifyTokenExp && user.verifyTokenExp < new Date()) {
            throw new common_1.BadRequestException('This verification link has expired — request a new one.');
        }
        await this.prisma.user.update({
            where: { id: user.id },
            data: { emailVerifiedAt: new Date(), verifyOtp: null, verifyOtpExp: null, verifyToken: null, verifyTokenExp: null },
        });
        await this.inquiries.markConverted(user.email, user.id).catch(() => { });
        return { verified: true, email: user.email };
    }
    async resendVerification(email) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (user && !user.emailVerifiedAt) {
            await this.issueOtp(user);
        }
        return { message: 'If that account needs verification, a code has been sent.' };
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const valid = await bcrypt.compare(dto.password, user.password);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (!user.emailVerifiedAt) {
            throw new common_1.UnauthorizedException('Please verify your email first — check your inbox for the verification link.');
        }
        const { password, ...userData } = user;
        return { user: userData, token: this.signToken(user.id, user.email) };
    }
    async updateProfile(userId, dto) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.country !== undefined ? { country: dto.country } : {}),
                ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
            },
        });
        const { password, ...userData } = user;
        return userData;
    }
    async recordConsent(userId) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { medicalConsentAt: new Date() },
        });
        return { medicalConsentAt: user.medicalConsentAt };
    }
    async getMe(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.UnauthorizedException();
        const { password, ...userData } = user;
        return userData;
    }
    signToken(userId, email) {
        return this.jwt.sign({ sub: userId, email }, { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, jwt_1.JwtService, mail_service_1.MailService, inquiries_service_1.InquiriesService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
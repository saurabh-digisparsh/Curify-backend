"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = require("helmet");
const app_module_1 = require("./app.module");
function assertRequiredEnv() {
    const required = ["JWT_SECRET", "DATABASE_URL"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
        throw new Error(`Missing required environment variable(s): ${missing.join(", ")}. ` +
            `Refusing to start. Set them in the environment before booting.`);
    }
    if ((process.env.JWT_SECRET || "").length < 32) {
        throw new Error("JWT_SECRET must be at least 32 characters. Refusing to start.");
    }
}
async function bootstrap() {
    assertRequiredEnv();
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
    const isProd = process.env.NODE_ENV === "production";
    app.use((0, helmet_1.default)({
        hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
        contentSecurityPolicy: {
            directives: { defaultSrc: ["'self'"], frameAncestors: ["'none'"] },
        },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        crossOriginResourcePolicy: { policy: "same-site" },
    }));
    const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    app.enableCors({
        origin: corsOrigins,
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    app.setGlobalPrefix("api");
    if (!isProd) {
        const config = new swagger_1.DocumentBuilder()
            .setTitle("Curify API")
            .setDescription("AI-Powered Medical Tourism Platform API")
            .setVersion("1.0")
            .addBearerAuth()
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup("api/docs", app, document);
    }
    const port = process.env.PORT || 4000;
    await app.listen(port);
    console.log(`🚀 Curify API running at http://localhost:${port}/api`);
    if (!isProd)
        console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map
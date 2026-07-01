"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
    app.enableCors({
        origin: process.env.CORS_ORIGINS?.split(",") || [
            "http://localhost:5173",
            "https://0d2b-122-179-90-204.ngrok-free.app",
        ],
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    app.setGlobalPrefix("api");
    const isProd = process.env.NODE_ENV === "production";
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
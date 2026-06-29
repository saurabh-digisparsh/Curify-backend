import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust the reverse proxy (nginx / Cloudflare / load balancer) so the rate
  // limiter keys off the real client IP (X-Forwarded-For), not the proxy's.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(",") || [
      "http://localhost:5173",
      "https://0d2b-122-179-90-204.ngrok-free.app",
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix("api");

  // Only publish the API blueprint outside production. In prod, exposing every
  // endpoint and its shape hands scrapers a ready-made map of the data API.
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle("Curify API")
      .setDescription("AI-Powered Medical Tourism Platform API")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Curify API running at http://localhost:${port}/api`);
  if (!isProd)
    console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();

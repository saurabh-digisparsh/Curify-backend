import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

/**
 * Fail fast if security-critical configuration is missing. A missing JWT_SECRET
 * previously fell back to a hardcoded literal (token-forgery risk); a missing
 * DATABASE_URL would surface as confusing runtime errors. We refuse to boot.
 */
function assertRequiredEnv() {
  const required = [
    "JWT_SECRET",
    "DATABASE_URL",
    // Payments: no fallback secrets — a missing key must stop boot, not silently
    // disable checkout or forge signatures. KEY_ID is public; the others are secret.
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Refusing to start. Set them in the environment before booting.`,
    );
  }
  if ((process.env.JWT_SECRET || "").length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters. Refusing to start.");
  }
}

async function bootstrap() {
  assertRequiredEnv();

  // rawBody: true keeps the exact bytes on req.rawBody so the Razorpay webhook can
  // verify the HMAC signature against what Razorpay actually signed (the JSON parser
  // would otherwise re-serialize and break the signature).
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Trust the reverse proxy (nginx / Cloudflare / load balancer) so the rate
  // limiter keys off the real client IP (X-Forwarded-For), not the proxy's.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  // Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.).
  const isProd = process.env.NODE_ENV === "production";
  app.use(
    helmet({
      // HSTS only meaningful over TLS; enable in prod (behind the TLS proxy).
      hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
      // The API serves JSON, not HTML, so a strict default-src CSP is safe here.
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'self'"], frameAncestors: ["'none'"] },
      },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );

  // CORS: explicit allow-list only. Configure via CORS_ORIGINS (comma-separated).
  // Falls back to the local dev frontend only — no hardcoded tunnels.
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

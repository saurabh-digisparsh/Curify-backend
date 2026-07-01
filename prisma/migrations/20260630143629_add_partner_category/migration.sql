-- AlterEnum
-- Adds the PARTNER value (🔵 business partner) to the LeadCategory enum,
-- placed before MARKETING to match prisma/schema.prisma ordering.
ALTER TYPE "LeadCategory" ADD VALUE 'PARTNER' BEFORE 'MARKETING';

CREATE TYPE "MagicLinkPurpose" AS ENUM ('LOGIN', 'REGISTER');
ALTER TABLE "magic_link_tokens" ADD COLUMN "purpose" "MagicLinkPurpose" NOT NULL DEFAULT 'LOGIN';

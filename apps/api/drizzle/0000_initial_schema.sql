CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'college_admin', 'student');
--> statement-breakpoint
CREATE TYPE "public"."interview_type" AS ENUM('technical', 'hr');
--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('in_progress', 'submitted', 'evaluated');
--> statement-breakpoint
CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(180) NOT NULL,
  "slug" varchar(180) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "role" "user_role" NOT NULL,
  "full_name" varchar(120) NOT NULL,
  "email" varchar(254) NOT NULL,
  "password_hash" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "roll_number" varchar(50) NOT NULL,
  "department" varchar(120),
  "graduation_year" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "student_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "resumes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "original_file_name" varchar(255) NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "storage_key" text NOT NULL,
  "extracted_text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "resume_id" uuid,
  "type" "interview_type" NOT NULL,
  "status" "interview_status" DEFAULT 'in_progress' NOT NULL,
  "role_title" varchar(160),
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interview_answers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "interview_id" uuid NOT NULL,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "sequence" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "interview_id" uuid NOT NULL,
  "overall_score" integer NOT NULL,
  "strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "improvements" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "summary" text NOT NULL,
  "rubric" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "interview_reports_interview_id_unique" UNIQUE("interview_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_student_id_student_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_student_id_student_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "interview_reports" ADD CONSTRAINT "interview_reports_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "users_organization_idx" ON "users" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "student_profiles_roll_idx" ON "student_profiles" USING btree ("roll_number");
--> statement-breakpoint
CREATE INDEX "resumes_student_idx" ON "resumes" USING btree ("student_id");
--> statement-breakpoint
CREATE INDEX "interviews_student_idx" ON "interviews" USING btree ("student_id");
--> statement-breakpoint
CREATE INDEX "interviews_status_idx" ON "interviews" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "interview_answers_sequence_unique" ON "interview_answers" USING btree ("interview_id", "sequence");

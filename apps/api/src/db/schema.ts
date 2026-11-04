import { pgTable, pgEnum, uuid, varchar, text, timestamp, boolean, integer, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['superadmin', 'college_admin', 'student']);
export const interviewType = pgEnum('interview_type', ['technical', 'hr']);
export const interviewStatus = pgEnum('interview_status', ['in_progress', 'submitted', 'evaluated']);

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 180 }).notNull(),
  slug: varchar('slug', { length: 180 }).notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  role: userRole('role').notNull(),
  fullName: varchar('full_name', { length: 120 }).notNull(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ organizationIdx: index('users_organization_idx').on(table.organizationId) }));

export const studentProfiles = pgTable('student_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  rollNumber: varchar('roll_number', { length: 50 }).notNull(),
  department: varchar('department', { length: 120 }),
  graduationYear: integer('graduation_year'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ rollOrgIdx: index('student_profiles_roll_idx').on(table.rollNumber) }));

export const resumes = pgTable('resumes', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentId: uuid('student_id').notNull().references(() => studentProfiles.id, { onDelete: 'cascade' }),
  originalFileName: varchar('original_file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  storageKey: text('storage_key').notNull(),
  extractedText: text('extracted_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ studentIdx: index('resumes_student_idx').on(table.studentId) }));

export const interviews = pgTable('interviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentId: uuid('student_id').notNull().references(() => studentProfiles.id, { onDelete: 'cascade' }),
  resumeId: uuid('resume_id').references(() => resumes.id, { onDelete: 'set null' }),
  type: interviewType('type').notNull(),
  status: interviewStatus('status').notNull().default('in_progress'),
  roleTitle: varchar('role_title', { length: 160 }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
}, (table) => ({ studentIdx: index('interviews_student_idx').on(table.studentId), statusIdx: index('interviews_status_idx').on(table.status) }));

export const interviewAnswers = pgTable('interview_answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  interviewId: uuid('interview_id').notNull().references(() => interviews.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  sequence: integer('sequence').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ interviewSequenceUnique: uniqueIndex('interview_answers_sequence_unique').on(table.interviewId, table.sequence) }));

export const interviewReports = pgTable('interview_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  interviewId: uuid('interview_id').notNull().references(() => interviews.id, { onDelete: 'cascade' }).unique(),
  overallScore: integer('overall_score').notNull(),
  strengths: jsonb('strengths').$type<string[]>().notNull().default([]),
  improvements: jsonb('improvements').$type<string[]>().notNull().default([]),
  summary: text('summary').notNull(),
  rubric: jsonb('rubric').$type<Record<string, number>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

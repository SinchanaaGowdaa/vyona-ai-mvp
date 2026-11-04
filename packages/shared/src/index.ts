import { z } from 'zod';

export const userRoleSchema = z.enum(['superadmin', 'college_admin', 'student']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const interviewTypeSchema = z.enum(['technical', 'hr']);
export type InterviewType = z.infer<typeof interviewTypeSchema>;

export const createStudentSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  rollNumber: z.string().trim().min(1).max(50),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

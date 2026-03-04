import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  slug: z.string().optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1, "API key name is required"),
  environment: z.enum(["live", "test"]).default("live"),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

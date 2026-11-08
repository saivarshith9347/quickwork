/**
 * React Query Hooks for Job Management
 * 
 * Provides hooks for:
 * - Fetching jobs (list and single)
 * - Creating jobs
 * - Updating jobs
 * - Deleting jobs
 * 
 * Uses React Query for:
 * - Automatic caching
 * - Background refetching
 * - Optimistic updates
 * - Loading/error states
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { JobService, type CreateJobParams, type GetJobsParams } from '../services/job-service';
import type { BaseJob, JobCategoryValue, JobStatusValue, JobLocationValue } from '../job-types';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...jobKeys.lists(), filters] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
  categories: (id: string) => [...jobKeys.detail(id), 'categories'] as const,
  positions: (id: string) => [...jobKeys.detail(id), 'positions'] as const,
};

// ─── Fetch Jobs ───────────────────────────────────────────────────────────────

export type UseJobsParams = GetJobsParams;

export function useJobs(
  params?: UseJobsParams,
  options?: Omit<UseQueryOptions<BaseJob[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<BaseJob[], Error>({
    queryKey: jobKeys.list(params || {}),
    queryFn: async () => {
      const result = await JobService.getJobs(params);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.jobs;
    },
    ...options,
  });
}

// ─── Fetch Single Job ─────────────────────────────────────────────────────────

export function useJob(
  jobId: string | undefined,
  options?: Omit<UseQueryOptions<BaseJob, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<BaseJob, Error>({
    queryKey: jobKeys.detail(jobId || ''),
    queryFn: async () => {
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      const result = await JobService.getJob(jobId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.job;
    },
    enabled: !!jobId && (options?.enabled ?? true),
    ...options,
  });
}

// ─── Create Job ───────────────────────────────────────────────────────────────

export type { CreateJobParams };

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateJobParams) => {
      const result = await JobService.createJob(params);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.jobId;
    },
    onSuccess: () => {
      // Invalidate all job lists so they refetch
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

// ─── Update Job ───────────────────────────────────────────────────────────────

interface UpdateJobParams {
  jobId: string;
  updates: {
    job_title?: string;
    description?: string;
    job_date?: string;
    start_time?: string;
    end_time?: string;
    status?: string;
    facilities?: string[] | null;
    requirements?: any;
    instructions?: any;
  };
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, updates }: UpdateJobParams) => {
      const result = await JobService.updateJob(jobId, updates);
      if (!result.success) {
        throw new Error(result.error);
      }
      return jobId;
    },
    onSuccess: (jobId) => {
      // Invalidate the specific job and all job lists
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

// ─── Delete Job ───────────────────────────────────────────────────────────────

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const result = await JobService.deleteJob(jobId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return jobId;
    },
    onSuccess: (jobId) => {
      // Remove the specific job from cache
      queryClient.removeQueries({ queryKey: jobKeys.detail(jobId) });
      // Invalidate all job lists
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

// ─── Update Job Status ────────────────────────────────────────────────────────

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: JobStatusValue }) => {
      const result = await JobService.updateJobStatus(jobId, status);
      if (!result.success) {
        throw new Error(result.error);
      }
      return jobId;
    },
    onSuccess: (jobId) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

// ─── Expire Rapid Job ─────────────────────────────────────────────────────────

export function useExpireRapidJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const result = await JobService.expireRapidJob(jobId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return jobId;
    },
    onSuccess: (jobId) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

// ─── Get Job Categories ───────────────────────────────────────────────────────

export function useJobCategories(
  jobId: string | undefined,
  options?: Omit<UseQueryOptions<any[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: jobKeys.categories(jobId || ''),
    queryFn: async () => {
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      const result = await JobService.getJobCategories(jobId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.categories;
    },
    enabled: !!jobId && (options?.enabled ?? true),
    ...options,
  });
}

// ─── Get Job Positions ────────────────────────────────────────────────────────

export function useJobPositions(
  jobId: string | undefined,
  options?: Omit<UseQueryOptions<any[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: jobKeys.positions(jobId || ''),
    queryFn: async () => {
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      const result = await JobService.getJobPositions(jobId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.positions;
    },
    enabled: !!jobId && (options?.enabled ?? true),
    ...options,
  });
}

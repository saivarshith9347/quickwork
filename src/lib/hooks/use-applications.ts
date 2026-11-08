/**
 * React Query Hooks for Application Management
 * 
 * Provides hooks for:
 * - Fetching applications (worker and employer views)
 * - Reserving positions
 * - Confirming bookings
 * - Cancelling applications
 * 
 * Uses React Query for:
 * - Automatic caching
 * - Background refetching
 * - Optimistic updates
 * - Loading/error states
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { ApplicationService, type Application, type ApplicationStatus } from '../services/application-service';
import { jobKeys } from './use-jobs';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const applicationKeys = {
  all: ['applications'] as const,
  lists: () => [...applicationKeys.all, 'list'] as const,
  workerLists: () => [...applicationKeys.lists(), 'worker'] as const,
  workerList: (workerId: string, filters?: Record<string, any>) =>
    [...applicationKeys.workerLists(), workerId, filters || {}] as const,
  jobLists: () => [...applicationKeys.lists(), 'job'] as const,
  jobList: (jobId: string, filters?: Record<string, any>) =>
    [...applicationKeys.jobLists(), jobId, filters || {}] as const,
  details: () => [...applicationKeys.all, 'detail'] as const,
  detail: (id: string) => [...applicationKeys.details(), id] as const,
  availablePositions: (jobId: string, categoryId?: string) =>
    [...applicationKeys.all, 'available-positions', jobId, categoryId || 'all'] as const,
};

// ─── Fetch Worker Applications ───────────────────────────────────────────────

interface UseWorkerApplicationsParams {
  workerId: string | undefined;
  status?: ApplicationStatus | ApplicationStatus[] | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export function useWorkerApplications(
  params: UseWorkerApplicationsParams,
  options?: Omit<UseQueryOptions<Application[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<Application[], Error>({
    queryKey: applicationKeys.workerList(params.workerId || '', {
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    }),
    queryFn: async () => {
      if (!params.workerId) {
        throw new Error('Worker ID is required');
      }
      const result = await ApplicationService.getWorkerApplications({
        workerId: params.workerId,
        status: params.status,
        limit: params.limit,
        offset: params.offset,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.applications;
    },
    enabled: !!params.workerId && (options?.enabled ?? true),
    ...options,
  });
}

// ─── Fetch Job Applications (Employer View) ──────────────────────────────────

interface UseJobApplicationsParams {
  jobId: string | undefined;
  status?: ApplicationStatus | ApplicationStatus[] | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export function useJobApplications(
  params: UseJobApplicationsParams,
  options?: Omit<UseQueryOptions<Application[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<Application[], Error>({
    queryKey: applicationKeys.jobList(params.jobId || '', {
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    }),
    queryFn: async () => {
      if (!params.jobId) {
        throw new Error('Job ID is required');
      }
      const result = await ApplicationService.getJobApplications({
        jobId: params.jobId,
        status: params.status,
        limit: params.limit,
        offset: params.offset,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.applications;
    },
    enabled: !!params.jobId && (options?.enabled ?? true),
    ...options,
  });
}

// ─── Fetch Single Application ─────────────────────────────────────────────────

export function useApplication(
  applicationId: string | undefined,
  options?: Omit<UseQueryOptions<Application, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<Application, Error>({
    queryKey: applicationKeys.detail(applicationId || ''),
    queryFn: async () => {
      if (!applicationId) {
        throw new Error('Application ID is required');
      }
      const result = await ApplicationService.getApplication(applicationId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.application;
    },
    enabled: !!applicationId && (options?.enabled ?? true),
    ...options,
  });
}

// ─── Check if Worker Applied ──────────────────────────────────────────────────

export function useHasWorkerApplied(params: {
  workerId: string | undefined;
  jobId: string | undefined;
}) {
  return useQuery({
    queryKey: [...applicationKeys.all, 'has-applied', params.workerId, params.jobId],
    queryFn: async () => {
      if (!params.workerId || !params.jobId) {
        return { hasApplied: false };
      }
      const result = await ApplicationService.hasWorkerApplied({
        workerId: params.workerId,
        jobId: params.jobId,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      return { hasApplied: result.hasApplied, applicationId: result.applicationId };
    },
    enabled: !!params.workerId && !!params.jobId,
  });
}

// ─── Get Available Positions ──────────────────────────────────────────────────

export function useAvailablePositions(params: {
  jobId: string | undefined;
  jobCategoryId?: string | undefined;
}) {
  return useQuery({
    queryKey: applicationKeys.availablePositions(params.jobId || '', params.jobCategoryId),
    queryFn: async () => {
      if (!params.jobId) {
        throw new Error('Job ID is required');
      }
      const result = await ApplicationService.getAvailablePositions({
        jobId: params.jobId,
        jobCategoryId: params.jobCategoryId,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.positions;
    },
    enabled: !!params.jobId,
  });
}

// ─── Reserve Position ─────────────────────────────────────────────────────────

interface ReservePositionParams {
  positionId: string;
  workerId?: string | undefined;
  jobId: string;
  jobCategoryId?: string | undefined;
  workerNote?: string | undefined;
}

export function useReservePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ReservePositionParams) => {
      const result = await ApplicationService.reservePosition(params);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: (data, variables) => {
      // Invalidate worker applications
      queryClient.invalidateQueries({ queryKey: applicationKeys.workerLists() });
      // Invalidate available positions
      queryClient.invalidateQueries({
        queryKey: applicationKeys.availablePositions(variables.jobId),
      });
      // Invalidate job details (positions count changed)
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(variables.jobId) });
      queryClient.invalidateQueries({ queryKey: jobKeys.positions(variables.jobId) });
    },
  });
}

// ─── Release Position ─────────────────────────────────────────────────────────

export function useReleasePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ positionId, jobId }: { positionId: string; jobId: string }) => {
      const result = await ApplicationService.releasePosition(positionId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return { positionId, jobId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: applicationKeys.availablePositions(data.jobId),
      });
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(data.jobId) });
      queryClient.invalidateQueries({ queryKey: jobKeys.positions(data.jobId) });
    },
  });
}

// ─── Confirm Booking ──────────────────────────────────────────────────────────

interface ConfirmBookingParams {
  positionId?: string | undefined;
  applicationId?: string | undefined;
  workerNote?: string | undefined;
  paymentId?: string | undefined;
}

export function useConfirmBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ConfirmBookingParams) => {
      const result = await ApplicationService.confirmBooking(params);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.applicationId;
    },
    onSuccess: (applicationId) => {
      // Invalidate the specific application
      queryClient.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
      // Invalidate all worker applications
      queryClient.invalidateQueries({ queryKey: applicationKeys.workerLists() });
      // Invalidate all job lists and details (status may have changed)
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobKeys.details() });
    },
  });
}

// ─── Cancel Application ───────────────────────────────────────────────────────

export function useCancelApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: string) => {
      const result = await ApplicationService.cancelApplication(applicationId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return applicationId;
    },
    onSuccess: (applicationId) => {
      // Invalidate the specific application
      queryClient.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
      // Invalidate all worker applications
      queryClient.invalidateQueries({ queryKey: applicationKeys.workerLists() });
      // Invalidate job applications lists
      queryClient.invalidateQueries({ queryKey: applicationKeys.jobLists() });
      // Invalidate all job lists and details (positions may be available again)
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobKeys.details() });
    },
  });
}

// ─── Update Application Status ────────────────────────────────────────────────

interface UpdateApplicationStatusParams {
  applicationId: string;
  status: ApplicationStatus;
  note?: string;
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, status, note }: UpdateApplicationStatusParams) => {
      const result = await ApplicationService.updateApplicationStatus(applicationId, status, note);
      if (!result.success) {
        throw new Error(result.error);
      }
      return applicationId;
    },
    onSuccess: (applicationId) => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
      queryClient.invalidateQueries({ queryKey: applicationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobKeys.details() });
    },
  });
}

// ─── Release Expired Locks ────────────────────────────────────────────────────

export function useReleaseExpiredLocks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await ApplicationService.releaseExpiredLocks();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.releasedCount;
    },
    onSuccess: () => {
      // Invalidate everything - positions may have been released
      queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}

/**
 * Job Service - Supabase Integration Layer
 * 
 * Provides CRUD operations for jobs with proper database persistence.
 * Bridges the gap between:
 * - Frontend types (BaseJob with nested JobLocation)
 * - Database schema (flattened location fields)
 * 
 * Key responsibilities:
 * - Transform data between frontend and database formats
 * - Handle job CRUD operations
 * - Calculate derived fields (positionsRemaining, status)
 * - Support rapid job lifecycle
 */

import { getSupabase } from '../supabase';
import type { Database } from '../database.types';
import {
  BaseJob,
  JobLocation,
  JobLocationValue,
  JobRequirements,
  JobInstructions,
  ReportingContact,
  JobCategoryValue,
  JobTypeValue,
  JobStatusValue,
  isStructuredLocation,
  calculatePositionsRemaining,
  calculateJobStatus,
  calculateDuration,
  isRapidJobExpired,
  calculateRapidJobExpiry,
} from '../job-types';

// ─── Database Types ───────────────────────────────────────────────────────────

type DbJob = Database['public']['Tables']['jobs']['Row'];
type DbJobInsert = Database['public']['Tables']['jobs']['Insert'];
type DbJobUpdate = Database['public']['Tables']['jobs']['Update'];
type DbJobCategory = Database['public']['Tables']['job_categories']['Row'];
type DbJobPosition = Database['public']['Tables']['job_positions']['Row'];

// ─── Transform Functions ──────────────────────────────────────────────────────

/**
 * Transform database job to frontend BaseJob format.
 * Reconstructs nested location object and calculates derived fields.
 */
export function dbJobToBaseJob(
  dbJob: DbJob,
  categories: DbJobCategory[],
  positions: DbJobPosition[]
): BaseJob {
  // Reconstruct location object
  const location: JobLocation = {
    venueName: dbJob.venue_name,
    fullAddress: dbJob.full_address,
    area: dbJob.area,
    city: dbJob.city,
    landmark: dbJob.landmark || undefined,
  };

  // Calculate position counts
  const positionsRequired = categories.reduce((sum, cat) => sum + cat.required_workers, 0);
  const positionsConfirmed = positions.filter(p => p.status === 'BOOKED' || p.status === 'ACCEPTED').length;
  const positionsRemaining = calculatePositionsRemaining(positionsRequired, positionsConfirmed);

  // Calculate duration
  const duration = calculateDuration(dbJob.start_time, dbJob.end_time);

  // Parse JSON fields
  const requirements = dbJob.requirements as JobRequirements | null;
  const instructions = dbJob.instructions as JobInstructions | null;

  // Calculate status (may override database status if outdated)
  const calculatedStatus = calculateJobStatus(
    positionsRequired,
    positionsConfirmed,
    dbJob.job_date,
    dbJob.status as JobStatusValue
  );

  return {
    id: dbJob.id,
    employerId: dbJob.employer_id,
    jobTitle: dbJob.job_title,
    category: dbJob.category as JobCategoryValue,
    description: dbJob.description,
    location,
    date: dbJob.job_date,
    startTime: dbJob.start_time,
    endTime: dbJob.end_time,
    duration,
    jobType: dbJob.job_type as JobTypeValue,
    positionsRequired,
    positionsConfirmed,
    positionsRemaining,
    status: calculatedStatus,
    wage: 0, // Will be calculated from categories (weighted average or first category)
    facilities: dbJob.facilities || undefined,
    isRapidJob: dbJob.is_rapid_job,
    rapidJobExpiresAt: dbJob.rapid_job_expires_at || undefined,
    requirements: requirements || undefined,
    instructions: instructions || undefined,
    reportingContact: undefined, // Private field - only visible to confirmed workers
    createdAt: dbJob.created_at,
    updatedAt: dbJob.updated_at,
  };
}

/**
 * Transform frontend BaseJob to database insert format.
 * Flattens location object and prepares JSON fields.
 */
export function baseJobToDbInsert(job: Partial<BaseJob> & {
  employerId: string;
  jobTitle: string;
  category: JobCategoryValue;
  description: string;
  location: JobLocationValue;
  date: string;
  startTime: string;
  endTime: string;
}): Omit<DbJobInsert, 'id' | 'created_at' | 'updated_at'> {
  // Flatten location
  let locationFields: {
    venue_name: string;
    full_address: string;
    area: string;
    city: string;
    landmark?: string | null;
  };

  if (isStructuredLocation(job.location)) {
    locationFields = {
      venue_name: job.location.venueName,
      full_address: job.location.fullAddress,
      area: job.location.area,
      city: job.location.city,
      landmark: job.location.landmark || null,
    };
  } else {
    // Legacy string format - parse what we can
    const parts = job.location.split(',').map(s => s.trim());
    locationFields = {
      venue_name: 'Unknown Venue',
      full_address: job.location,
      area: parts[0] || job.location,
      city: parts[parts.length - 1] || 'Unknown City',
      landmark: null,
    };
  }

  return {
    employer_id: job.employerId,
    job_title: job.jobTitle,
    category: job.category,
    description: job.description,
    ...locationFields,
    job_date: job.date,
    start_time: job.startTime,
    end_time: job.endTime,
    job_type: job.jobType || 'one-time',
    status: job.status || 'Open',
    facilities: job.facilities || null,
    is_rapid_job: job.isRapidJob || false,
    rapid_job_expires_at: job.rapidJobExpiresAt || null,
    requirements: (job.requirements as any) || null,
    instructions: (job.instructions as any) || null,
  };
}

// ─── Service Class ────────────────────────────────────────────────────────────

export interface CreateJobParams {
  job: Partial<BaseJob> & {
    employerId: string;
    jobTitle: string;
    category: JobCategoryValue;
    description: string;
    location: JobLocationValue;
    date: string;
    startTime: string;
    endTime: string;
    jobType?: JobTypeValue | undefined;
    isRapidJob?: boolean | undefined;
    rapidJobExpiresAt?: string | undefined;
    facilities?: string[] | undefined;
    requirements?: JobRequirements | undefined;
    instructions?: JobInstructions | undefined;
  };
  categories: Array<{
    name: string;
    description?: string | undefined;
    requiredWorkers: number;
    wage: number;
    requirements?: JobRequirements | undefined;
  }>;
}

export interface GetJobsParams {
  employerId?: string | undefined;
  category?: JobCategoryValue | undefined;
  status?: JobStatusValue | undefined;
  isRapidJob?: boolean | undefined;
  city?: string | undefined;
  area?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export class JobService {
  /**
   * Create a new job with categories and positions.
   * This is a transactional operation that:
   * 1. Inserts the job
   * 2. Creates job categories
   * 3. Generates position slots for each category
   */
  static async createJob(params: CreateJobParams): Promise<{ success: true; jobId: string } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      // 1. Insert job
      const jobData = baseJobToDbInsert(params.job);
      const { data: insertedJob, error: jobError } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single();

      if (jobError || !insertedJob) {
        console.error('Failed to create job:', jobError);
        return { success: false, error: jobError?.message || 'Failed to create job' };
      }

      // 2. Insert job categories
      const categoriesData = params.categories.map((cat, index) => ({
        job_id: insertedJob.id,
        name: cat.name,
        description: cat.description || null,
        required_workers: cat.requiredWorkers,
        wage: cat.wage,
        requirements: (cat.requirements as any) || null,
        sort_order: index,
      }));

      const { data: insertedCategories, error: categoriesError } = await supabase
        .from('job_categories')
        .insert(categoriesData)
        .select();

      if (categoriesError || !insertedCategories) {
        console.error('Failed to create categories:', categoriesError);
        // Cleanup: delete the job
        await supabase.from('jobs').delete().eq('id', insertedJob.id);
        return { success: false, error: categoriesError?.message || 'Failed to create categories' };
      }

      // 3. Generate position slots for each category
      const positionsData: Array<{
        job_id: string;
        job_category_id: string;
        position_number: number;
        status: string;
      }> = [];

      insertedCategories.forEach((category) => {
        for (let i = 1; i <= category.required_workers; i++) {
          positionsData.push({
            job_id: insertedJob.id,
            job_category_id: category.id,
            position_number: i,
            status: 'AVAILABLE',
          });
        }
      });

      const { error: positionsError } = await supabase
        .from('job_positions')
        .insert(positionsData);

      if (positionsError) {
        console.error('Failed to create positions:', positionsError);
        // Cleanup: delete categories and job
        await supabase.from('job_categories').delete().eq('job_id', insertedJob.id);
        await supabase.from('jobs').delete().eq('id', insertedJob.id);
        return { success: false, error: positionsError.message };
      }

      return { success: true, jobId: insertedJob.id };
    } catch (error) {
      console.error('Exception creating job:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get a single job by ID with all related data.
   */
  static async getJob(jobId: string): Promise<{ success: true; job: BaseJob } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      // Fetch job
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !jobData) {
        return { success: false, error: jobError?.message || 'Job not found' };
      }

      // Fetch categories
      const { data: categories, error: categoriesError } = await supabase
        .from('job_categories')
        .select('*')
        .eq('job_id', jobId)
        .order('sort_order', { ascending: true });

      if (categoriesError) {
        return { success: false, error: categoriesError.message };
      }

      // Fetch positions
      const { data: positions, error: positionsError } = await supabase
        .from('job_positions')
        .select('*')
        .eq('job_id', jobId);

      if (positionsError) {
        return { success: false, error: positionsError.message };
      }

      const job = dbJobToBaseJob(jobData, categories || [], positions || []);
      
      // If categories exist, calculate weighted average wage
      if (categories && categories.length > 0) {
        const totalWage = categories.reduce((sum, cat) => sum + (cat.wage * cat.required_workers), 0);
        const totalWorkers = categories.reduce((sum, cat) => sum + cat.required_workers, 0);
        job.wage = totalWorkers > 0 ? Math.round(totalWage / totalWorkers) : (categories[0]?.wage ?? 0);
      }

      return { success: true, job };
    } catch (error) {
      console.error('Exception fetching job:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get all jobs (optionally filtered).
   */
  static async getJobs(params?: GetJobsParams): Promise<{ success: true; jobs: BaseJob[]; total: number } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      // Build query
      let query = supabase.from('jobs').select('*', { count: 'exact' });

      if (params?.employerId) {
        query = query.eq('employer_id', params.employerId);
      }
      if (params?.category) {
        query = query.eq('category', params.category);
      }
      if (params?.status) {
        query = query.eq('status', params.status);
      }
      if (params?.isRapidJob !== undefined) {
        query = query.eq('is_rapid_job', params.isRapidJob);
      }
      if (params?.city) {
        query = query.eq('city', params.city);
      }
      if (params?.area) {
        query = query.eq('area', params.area);
      }

      // Order by created_at descending (newest first)
      query = query.order('created_at', { ascending: false });

      // Apply pagination
      if (params?.limit) {
        query = query.limit(params.limit);
      }
      if (params?.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
      }

      const { data: jobsData, error: jobsError, count } = await query;

      if (jobsError) {
        return { success: false, error: jobsError.message };
      }

      if (!jobsData || jobsData.length === 0) {
        return { success: true, jobs: [], total: count || 0 };
      }

      // Fetch related data for all jobs
      const jobIds = jobsData.map(j => j.id);

      const { data: allCategories, error: categoriesError } = await supabase
        .from('job_categories')
        .select('*')
        .in('job_id', jobIds);

      if (categoriesError) {
        return { success: false, error: categoriesError.message };
      }

      const { data: allPositions, error: positionsError } = await supabase
        .from('job_positions')
        .select('*')
        .in('job_id', jobIds);

      if (positionsError) {
        return { success: false, error: positionsError.message };
      }

      // Group by job ID
      const categoriesByJob = new Map<string, DbJobCategory[]>();
      const positionsByJob = new Map<string, DbJobPosition[]>();

      allCategories?.forEach(cat => {
        const existing = categoriesByJob.get(cat.job_id) || [];
        existing.push(cat);
        categoriesByJob.set(cat.job_id, existing);
      });

      allPositions?.forEach(pos => {
        const existing = positionsByJob.get(pos.job_id) || [];
        existing.push(pos);
        positionsByJob.set(pos.job_id, existing);
      });

      // Transform to BaseJob
      const jobs = jobsData.map(dbJob => {
        const categories = categoriesByJob.get(dbJob.id) || [];
        const positions = positionsByJob.get(dbJob.id) || [];
        const job = dbJobToBaseJob(dbJob, categories, positions);

        // Calculate weighted average wage
        if (categories.length > 0) {
          const totalWage = categories.reduce((sum, cat) => sum + (cat.wage * cat.required_workers), 0);
          const totalWorkers = categories.reduce((sum, cat) => sum + cat.required_workers, 0);
          job.wage = totalWorkers > 0 ? Math.round(totalWage / totalWorkers) : (categories[0]?.wage ?? 0);
        }

        return job;
      });

      return { success: true, jobs, total: count || jobs.length };
    } catch (error) {
      console.error('Exception fetching jobs:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update job basic information (not categories/positions).
   */
  static async updateJob(
    jobId: string,
    updates: Partial<DbJobUpdate>
  ): Promise<{ success: true } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Exception updating job:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Delete a job and all related data.
   * Cascading deletes should handle categories/positions, but we'll be explicit.
   */
  static async deleteJob(jobId: string): Promise<{ success: true } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      // Delete positions first
      await supabase.from('job_positions').delete().eq('job_id', jobId);

      // Delete categories
      await supabase.from('job_categories').delete().eq('job_id', jobId);

      // Delete job
      const { error } = await supabase.from('jobs').delete().eq('id', jobId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Exception deleting job:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update job status (typically called by scheduled job or after position changes).
   */
  static async updateJobStatus(
    jobId: string,
    newStatus: JobStatusValue
  ): Promise<{ success: true } | { success: false; error: string }> {
    return JobService.updateJob(jobId, { status: newStatus });
  }

  /**
   * Handle rapid job expiry.
   * Marks expired rapid jobs as cancelled if still open.
   */
  static async expireRapidJob(jobId: string): Promise<{ success: true } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      // Only update if job is rapid and status is Open or PartiallyFilled
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'Cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('is_rapid_job', true)
        .in('status', ['Open', 'PartiallyFilled']);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Exception expiring rapid job:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get all expired rapid jobs that need status updates.
   */
  static async getExpiredRapidJobs(): Promise<{ success: true; jobIds: string[] } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('jobs')
        .select('id')
        .eq('is_rapid_job', true)
        .in('status', ['Open', 'PartiallyFilled'])
        .not('rapid_job_expires_at', 'is', null)
        .lt('rapid_job_expires_at', now);

      if (error) {
        return { success: false, error: error.message };
      }

      const jobIds = data?.map(job => job.id) || [];
      return { success: true, jobIds };
    } catch (error) {
      console.error('Exception fetching expired rapid jobs:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get job categories for a specific job.
   */
  static async getJobCategories(
    jobId: string
  ): Promise<{ success: true; categories: DbJobCategory[] } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { data, error } = await supabase
        .from('job_categories')
        .select('*')
        .eq('job_id', jobId)
        .order('sort_order', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, categories: data || [] };
    } catch (error) {
      console.error('Exception fetching job categories:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get job positions for a specific job.
   */
  static async getJobPositions(
    jobId: string
  ): Promise<{ success: true; positions: DbJobPosition[] } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { data, error } = await supabase
        .from('job_positions')
        .select('*')
        .eq('job_id', jobId)
        .order('position_number', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, positions: data || [] };
    } catch (error) {
      console.error('Exception fetching job positions:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export default JobService;

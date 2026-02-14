import { z } from 'zod';
import { supabase } from './supabase';

/**
 * Zod schema for team list validation.
 * Enforces: non-empty names, max 50 chars, max 5 teams, unique names (case-insensitive).
 */
export const TeamListSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'Team name cannot be empty')
      .max(50, 'Team name too long')
  )
  .max(5, 'Maximum 5 teams allowed')
  .refine(
    (teams) =>
      new Set(teams.map((t) => t.toLowerCase())).size === teams.length,
    { message: 'Team names must be unique (case-insensitive)' }
  );

/**
 * Validates a team list against the TeamListSchema.
 * @param teams - Array of team names to validate
 * @returns Object with valid flag and optional error message
 */
export function validateTeamList(
  teams: string[]
): { valid: boolean; error?: string } {
  const result = TeamListSchema.safeParse(teams);
  if (!result.success) {
    return {
      valid: false,
      error: result.error.errors[0]?.message || 'Invalid team list',
    };
  }
  return { valid: true };
}

/**
 * Updates the teams configuration for a session.
 * Validates team list before updating the database.
 * @param sessionId - The session ID to update
 * @param teams - Array of team names
 * @returns Object with success flag and optional error message
 */
export async function updateSessionTeams(
  sessionId: string,
  teams: string[]
): Promise<{ success: boolean; error?: string }> {
  // Validate team list
  const validation = validateTeamList(teams);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Update sessions table
  const { error } = await supabase
    .from('sessions')
    .update({ teams })
    .eq('session_id', sessionId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Fetches the teams configuration for a session.
 * @param sessionId - The session ID to fetch teams for
 * @returns Array of team names (empty array if no teams configured or if error)
 */
export async function fetchSessionTeams(
  sessionId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('teams')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) {
    return [];
  }

  return data.teams || [];
}

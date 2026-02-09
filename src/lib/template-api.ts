import { supabase } from './supabase';
import type { ResponseTemplate } from '../types/database';
import { useTemplateStore } from '../stores/template-store';

/**
 * Fetch all templates from Supabase, ordered by name ascending.
 * Updates the template store with the results.
 */
export async function fetchTemplates(): Promise<ResponseTemplate[]> {
  const { data, error } = await supabase
    .from('response_templates')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;

  const templates = data ?? [];
  useTemplateStore.getState().setTemplates(templates);
  return templates;
}

/**
 * Create a new template.
 * Updates the store on success.
 * Throws user-friendly error if name already exists.
 */
export async function createTemplate(
  name: string,
  options: string[]
): Promise<ResponseTemplate> {
  const { data, error } = await supabase
    .from('response_templates')
    .insert({ name, options })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      throw new Error('A template with this name already exists');
    }
    throw error;
  }

  useTemplateStore.getState().addTemplate(data);
  return data;
}

/**
 * Update an existing template.
 * Updates the store on success.
 * Throws user-friendly error if name conflict.
 */
export async function updateTemplate(
  id: string,
  updates: { name?: string; options?: string[] }
): Promise<ResponseTemplate> {
  const { data, error } = await supabase
    .from('response_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      throw new Error('A template with this name already exists');
    }
    throw error;
  }

  useTemplateStore.getState().updateTemplate(id, data);
  return data;
}

/**
 * Delete a template.
 * ON DELETE SET NULL ensures linked questions are detached (keep their options).
 * Updates the store on success.
 */
export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('response_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;

  useTemplateStore.getState().removeTemplate(id);
}

/**
 * Get the count of questions using a specific template.
 * Used for delete confirmation warnings.
 */
export async function getTemplateUsageCount(templateId: string): Promise<number> {
  const { data, error } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', templateId);

  if (error) throw error;

  return data ? (data as any).count : 0;
}

/**
 * Check if any questions using this template have received votes.
 * Returns true if votes exist (edit should be blocked), false if safe to edit.
 */
export async function checkTemplateVotes(templateId: string): Promise<boolean> {
  // Get all questions using this template
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('id')
    .eq('template_id', templateId);

  if (questionsError) throw questionsError;

  // If no questions use this template, safe to edit
  if (!questions || questions.length === 0) {
    return false;
  }

  // Check if any of these questions have votes
  const questionIds = questions.map((q) => q.id);
  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('id')
    .in('question_id', questionIds)
    .limit(1);

  if (votesError) throw votesError;

  // Return true if votes exist (not safe to edit)
  return votes !== null && votes.length > 0;
}

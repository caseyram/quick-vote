import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import { useTemplateStore } from '../stores/template-store';
import { fetchTemplates, checkQuestionVotes } from '../lib/template-api';
import { TemplateSelector } from './TemplateSelector';
import { ConfirmDialog } from './ConfirmDialog';
import type { Question, VoteType } from '../types/database';

interface QuestionFormProps {
  sessionId: string;
  batchId?: string | null;  // If provided, question will be created in this batch
  editingQuestion?: Question;
  onSaved: () => void;
  onCancel?: () => void;
}

export default function QuestionForm({ sessionId, batchId, editingQuestion, onSaved, onCancel }: QuestionFormProps) {
  const [text, setText] = useState('');
  const [type, setType] = useState<VoteType>('agree_disagree');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(editingQuestion?.template_id ?? null);
  const [detachConfirm, setDetachConfirm] = useState<{ templateName: string; options: string[] } | null>(null);
  const [replaceConfirm, setReplaceConfirm] = useState<{ newTemplateId: string; newTemplateName: string } | null>(null);
  const [hasVotes, setHasVotes] = useState(false);

  // Template store
  const { templates, loading: templatesLoading } = useTemplateStore();
  const selectedTemplate = templates.find(t => t.id === templateId) ?? null;
  const isLocked = !!selectedTemplate;

  // Fetch templates on mount if not loaded
  useEffect(() => {
    if (templates.length === 0 && !templatesLoading) {
      fetchTemplates();
    }
  }, [templates.length, templatesLoading]);

  // Pre-fill form when editing or reset when creating
  useEffect(() => {
    if (editingQuestion) {
      setText(editingQuestion.text);
      setType(editingQuestion.type);
      setTemplateId(editingQuestion.template_id ?? null);
      setOptions(
        editingQuestion.type === 'multiple_choice' && editingQuestion.options
          ? [...editingQuestion.options]
          : ['', '']
      );
      // Check if question has votes (blocks template changes)
      checkQuestionVotes(editingQuestion.id).then(setHasVotes);
    } else {
      setText('');
      setType('agree_disagree');
      setOptions(['', '']);
      setHasVotes(false);
      // Check for session default template
      const session = useSessionStore.getState().session;
      const defaultTemplateId = session?.default_template_id ?? null;
      setTemplateId(defaultTemplateId);
    }
    setErrorMsg(null);
  }, [editingQuestion]);

  function handleOptionChange(index: number, value: string) {
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  }

  function addOption() {
    if (options.length >= 10) return;
    setOptions((prev) => [...prev, '']);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleTemplateChange(newTemplateId: string | null) {
    // Block template changes if question has votes
    if (editingQuestion && hasVotes) {
      setErrorMsg('Cannot change template: question has received votes');
      return;
    }

    // If detaching (switching to null/custom)
    if (newTemplateId === null && selectedTemplate) {
      setDetachConfirm({
        templateName: selectedTemplate.name,
        options: selectedTemplate.options,
      });
      return;
    }

    // If switching from custom options to a template
    if (newTemplateId !== null && !selectedTemplate) {
      const hasCustomOptions = options.some(opt => opt.trim().length > 0);
      if (hasCustomOptions) {
        const newTemplate = templates.find(t => t.id === newTemplateId);
        if (newTemplate) {
          setReplaceConfirm({
            newTemplateId,
            newTemplateName: newTemplate.name,
          });
          return;
        }
      }
    }

    // Otherwise, just change the template
    setTemplateId(newTemplateId);
    setErrorMsg(null);
  }

  function handleDetachConfirm() {
    if (detachConfirm) {
      setOptions([...detachConfirm.options]);
      setTemplateId(null);
      setDetachConfirm(null);
      setErrorMsg(null);
    }
  }

  function handleDetachCancel() {
    setDetachConfirm(null);
  }

  function handleReplaceConfirm() {
    if (replaceConfirm) {
      setTemplateId(replaceConfirm.newTemplateId);
      setReplaceConfirm(null);
      setErrorMsg(null);
    }
  }

  function handleReplaceCancel() {
    setReplaceConfirm(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedText = text.trim();
    if (!trimmedText) {
      setErrorMsg('Question text is required.');
      return;
    }

    // Determine options: use template options if locked, custom options otherwise
    let finalOptions: string[] | null = null;
    if (type === 'multiple_choice') {
      if (isLocked && selectedTemplate) {
        finalOptions = selectedTemplate.options;
      } else {
        finalOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
      }
    }

    if (type === 'multiple_choice' && (!finalOptions || finalOptions.length < 2)) {
      setErrorMsg('Multiple choice questions need at least 2 non-empty options.');
      return;
    }

    setSaving(true);

    try {
      if (editingQuestion) {
        // Edit mode
        const { data, error } = await supabase
          .from('questions')
          .update({
            text: trimmedText,
            type,
            options: finalOptions,
            template_id: templateId,
          })
          .eq('id', editingQuestion.id)
          .select()
          .single();

        if (error) {
          setErrorMsg(error.message);
          return;
        }

        useSessionStore.getState().updateQuestion(editingQuestion.id, data);
        onSaved();
      } else {
        // Add mode -- find next position
        // If batchId is provided, find max position among questions with same batch_id
        // Otherwise, find max position among all questions in the session
        let positionQuery = supabase
          .from('questions')
          .select('position')
          .eq('session_id', sessionId)
          .order('position', { ascending: false })
          .limit(1);

        if (batchId) {
          positionQuery = positionQuery.eq('batch_id', batchId);
        }

        const { data: maxRow } = await positionQuery;

        const nextPosition = maxRow && maxRow.length > 0 ? maxRow[0].position + 1 : 0;

        const { data, error } = await supabase
          .from('questions')
          .insert({
            session_id: sessionId,
            batch_id: batchId ?? null,
            text: trimmedText,
            type,
            options: finalOptions,
            template_id: templateId,
            position: nextPosition,
          })
          .select()
          .single();

        if (error) {
          setErrorMsg(error.message);
          return;
        }

        useSessionStore.getState().addQuestion(data);
        onSaved();

        // Reset form after add
        setText('');
        setType('agree_disagree');
        setOptions(['', '']);
        // Reset to session default template (if any)
        const session = useSessionStore.getState().session;
        const defaultTemplateId = session?.default_template_id ?? null;
        setTemplateId(defaultTemplateId);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-white">
        {editingQuestion ? 'Edit Question' : 'Add Question'}
      </h3>

      {/* Question text */}
      <div>
        <label htmlFor="question-text" className="block text-sm font-medium text-gray-300 mb-1">
          Question Text
        </label>
        <textarea
          id="question-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter your question or statement..."
          rows={3}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Vote type selector */}
      <fieldset>
        <legend className="block text-sm font-medium text-gray-300 mb-2">Vote Type</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
            <input
              type="radio"
              name="vote-type"
              value="agree_disagree"
              checked={type === 'agree_disagree'}
              onChange={() => setType('agree_disagree')}
              className="text-indigo-500 focus:ring-indigo-500 bg-gray-800 border-gray-600"
            />
            Agree / Disagree
          </label>
          <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
            <input
              type="radio"
              name="vote-type"
              value="multiple_choice"
              checked={type === 'multiple_choice'}
              onChange={() => setType('multiple_choice')}
              className="text-indigo-500 focus:ring-indigo-500 bg-gray-800 border-gray-600"
            />
            Multiple Choice
          </label>
        </div>
      </fieldset>

      {/* Template selector (only for multiple choice) */}
      {type === 'multiple_choice' && (
        <>
          {templatesLoading ? (
            <div className="h-10 bg-gray-100 animate-pulse rounded" />
          ) : (
            <TemplateSelector
              value={templateId}
              onChange={handleTemplateChange}
              templates={templates}
              disabled={hasVotes && !!editingQuestion}
              disabledReason={hasVotes && !!editingQuestion ? 'Template locked: question has received votes' : undefined}
            />
          )}
        </>
      )}

      {/* Multiple choice options */}
      {type === 'multiple_choice' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-300">Options</p>
            {isLocked && selectedTemplate && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                  Template: {selectedTemplate.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleTemplateChange(null)}
                  className="text-indigo-600 hover:text-indigo-500 underline text-xs"
                  disabled={hasVotes && !!editingQuestion}
                >
                  Detach
                </button>
              </div>
            )}
          </div>

          {isLocked && selectedTemplate ? (
            // Locked template options (read-only)
            <div className="space-y-2">
              {selectedTemplate.options.map((opt, i) => (
                <div key={i} className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500">
                  {opt}
                </div>
              ))}
              <p className="text-xs text-gray-400">Options are locked while template is assigned. Detach to customize.</p>
            </div>
          ) : (
            // Editable custom options
            <div className="space-y-2">
              {options.map((opt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="px-2 py-2 text-red-400 hover:text-red-300 text-sm font-medium"
                      aria-label={`Remove option ${index + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {options.length < 10 && (
                <button
                  type="button"
                  onClick={addOption}
                  className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  + Add Option
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <p className="text-red-400 text-sm">{errorMsg}</p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving
            ? 'Saving...'
            : editingQuestion
              ? 'Update Question'
              : 'Add Question'}
        </button>
        {editingQuestion && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Detach confirmation dialog */}
      <ConfirmDialog
        isOpen={!!detachConfirm}
        onConfirm={handleDetachConfirm}
        onCancel={handleDetachCancel}
        title="Detach from template?"
        message={`Options from '${detachConfirm?.templateName}' will become editable. The template itself won't be affected.`}
        confirmLabel="Detach"
        confirmVariant="primary"
      />

      {/* Replace confirmation dialog */}
      <ConfirmDialog
        isOpen={!!replaceConfirm}
        onConfirm={handleReplaceConfirm}
        onCancel={handleReplaceCancel}
        title="Replace custom options?"
        message="Current options will be replaced with the template's options."
        confirmLabel="Replace"
        confirmVariant="primary"
      />
    </form>
  );
}

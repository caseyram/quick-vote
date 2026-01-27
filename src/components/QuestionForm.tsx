import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session-store';
import type { Question, VoteType } from '../types/database';

interface QuestionFormProps {
  sessionId: string;
  editingQuestion?: Question;
  onSaved: () => void;
  onCancel?: () => void;
}

export default function QuestionForm({ sessionId, editingQuestion, onSaved, onCancel }: QuestionFormProps) {
  const [text, setText] = useState('');
  const [type, setType] = useState<VoteType>('agree_disagree');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pre-fill form when editing
  useEffect(() => {
    if (editingQuestion) {
      setText(editingQuestion.text);
      setType(editingQuestion.type);
      setOptions(
        editingQuestion.type === 'multiple_choice' && editingQuestion.options
          ? [...editingQuestion.options]
          : ['', '']
      );
    } else {
      setText('');
      setType('agree_disagree');
      setOptions(['', '']);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedText = text.trim();
    if (!trimmedText) {
      setErrorMsg('Question text is required.');
      return;
    }

    const filteredOptions = type === 'multiple_choice'
      ? options.map((o) => o.trim()).filter((o) => o.length > 0)
      : null;

    if (type === 'multiple_choice' && (!filteredOptions || filteredOptions.length < 2)) {
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
            options: filteredOptions,
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
        const { data: maxRow } = await supabase
          .from('questions')
          .select('position')
          .eq('session_id', sessionId)
          .order('position', { ascending: false })
          .limit(1);

        const nextPosition = maxRow && maxRow.length > 0 ? maxRow[0].position + 1 : 0;

        const { data, error } = await supabase
          .from('questions')
          .insert({
            session_id: sessionId,
            text: trimmedText,
            type,
            options: filteredOptions,
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

      {/* Multiple choice options */}
      {type === 'multiple_choice' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-300">Options</p>
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
    </form>
  );
}

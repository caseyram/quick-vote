import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { useCallback, useEffect, useRef } from 'react';

// Bullet characters commonly pasted from PowerPoint, Google Slides, Keynote, etc.
const BULLET_CHARS = /^[\u2022\u2023\u2043\u25E6\u25AA\u25AB\u25CF\u25CB\u2013\u2014\u00B7\u2219\-\*]\s*/;

/**
 * Converts plain-text bullet lines into HTML <ul><li> on paste.
 * Handles both plain text paste and HTML paste where bullets came through as text.
 */
const PasteBulletConverter = Extension.create({
  name: 'pasteBulletConverter',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pasteBulletConverter'),
        props: {
          transformPastedText(text) {
            return convertBulletText(text);
          },
          transformPastedHTML(html) {
            // If the HTML already contains proper list markup, leave it alone
            if (/<[uo]l[\s>]/i.test(html)) return html;

            // Parse as DOM and check for bullet-char lines in paragraphs/divs
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const blocks = doc.body.querySelectorAll('p, div, span');

            let hasBullets = false;
            blocks.forEach((el) => {
              if (BULLET_CHARS.test(el.textContent?.trim() || '')) {
                hasBullets = true;
              }
            });

            if (!hasBullets) return html;

            // Convert: walk through body children, group consecutive bullet lines into <ul>
            return convertBulletHtml(doc.body);
          },
        },
      }),
    ];
  },
});

function convertBulletText(text: string): string {
  const lines = text.split('\n');
  let result = '';
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (BULLET_CHARS.test(trimmed)) {
      if (!inList) {
        result += '<ul>';
        inList = true;
      }
      result += `<li>${trimmed.replace(BULLET_CHARS, '')}</li>`;
    } else {
      if (inList) {
        result += '</ul>';
        inList = false;
      }
      result += trimmed ? `<p>${trimmed}</p>` : '';
    }
  }
  if (inList) result += '</ul>';

  return result;
}

function convertBulletHtml(body: HTMLElement): string {
  const children = Array.from(body.childNodes);
  let result = '';
  let inList = false;

  for (const node of children) {
    const text = node.textContent?.trim() || '';
    if (BULLET_CHARS.test(text)) {
      if (!inList) {
        result += '<ul>';
        inList = true;
      }
      result += `<li>${text.replace(BULLET_CHARS, '')}</li>`;
    } else {
      if (inList) {
        result += '</ul>';
        inList = false;
      }
      if (node instanceof HTMLElement) {
        result += node.outerHTML;
      } else if (text) {
        result += `<p>${text}</p>`;
      }
    }
  }
  if (inList) result += '</ul>';

  return result;
}

interface SlideNotesEditorProps {
  content: string | null;
  onUpdate: (html: string) => void;
}

// Debounce utility
function useDebounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]) as T;
}

export function SlideNotesEditor({ content, onUpdate }: SlideNotesEditorProps) {
  const debouncedUpdate = useDebounce(onUpdate, 500);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({
        placeholder: 'Add presenter notes...',
      }),
      PasteBulletConverter,
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      debouncedUpdate(html === '<p></p>' ? '' : html);
    },
  });

  // Update content when prop changes (external update)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
  }, [editor, content]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('bold') ? 'bg-gray-200' : ''
          }`}
          title="Bold"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 110 8H6zM6 12h9a4 4 0 110 8H6z" />
          </svg>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('italic') ? 'bg-gray-200' : ''
          }`}
          title="Italic"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4v16h-4z" />
          </svg>
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('bulletList') ? 'bg-gray-200' : ''
          }`}
          title="Bullet List"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="6" cy="12" r="2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h10M12 12h10M12 18h10" />
          </svg>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('orderedList') ? 'bg-gray-200' : ''
          }`}
          title="Numbered List"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h10M12 12h10M12 18h10" />
            <text x="6" y="9" fontSize="8" textAnchor="middle">1</text>
            <text x="6" y="15" fontSize="8" textAnchor="middle">2</text>
            <text x="6" y="21" fontSize="8" textAnchor="middle">3</text>
          </svg>
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-gray-200 transition-colors text-sm font-medium ${
            editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : ''
          }`}
          title="Heading 1"
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-gray-200 transition-colors text-sm font-medium ${
            editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''
          }`}
          title="Heading 2"
        >
          H2
        </button>
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[120px] focus-within:outline-none"
      />
    </div>
  );
}
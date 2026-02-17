import { useState, useRef } from 'react';
import { X, Plus } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function TagInput({ tags, onTagsChange }: TagInputProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setInputValue('');
    setIsAdding(false);
  };

  const removeTag = (tag: string) => {
    onTagsChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(inputValue); }
    if (e.key === 'Escape') { setInputValue(''); setIsAdding(false); }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full px-2.5 py-0.5"
          style={{
            backgroundColor: 'var(--c-tag-bg)',
            border: '1px solid var(--c-tag-border)',
            color: 'var(--c-tag-color)',
            fontSize: '11px',
          }}
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="flex items-center justify-center rounded-full cursor-pointer transition-colors"
            style={{ width: 14, height: 14 }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--c-error-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <X size={8} />
          </button>
        </span>
      ))}
      {isAdding ? (
        <input
          ref={inputRef}
          autoFocus
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (inputValue.trim()) addTag(inputValue); else setIsAdding(false); }}
          placeholder="tag name"
          className="outline-none rounded px-2 py-0.5"
          style={{
            backgroundColor: 'var(--c-bg-input)',
            border: '1px solid var(--c-accent-border)',
            color: 'var(--c-text)',
            fontSize: '11px',
            width: 80,
          }}
        />
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-0.5 rounded-full px-2 py-0.5 cursor-pointer transition-colors"
          style={{
            backgroundColor: 'var(--c-bg-input)',
            border: '1px dashed var(--c-border-dashed)',
            color: 'var(--c-text-muted)',
            fontSize: '11px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--c-accent-bg-subtle)';
            e.currentTarget.style.borderColor = 'var(--c-accent-border)';
            e.currentTarget.style.color = 'var(--c-accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--c-bg-input)';
            e.currentTarget.style.borderColor = 'var(--c-border-dashed)';
            e.currentTarget.style.color = 'var(--c-text-muted)';
          }}
        >
          <Plus size={10} />
          tag
        </button>
      )}
    </div>
  );
}

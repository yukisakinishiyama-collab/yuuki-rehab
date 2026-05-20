interface Props {
  tag: string
  onRemove?: () => void
}

export default function TagBadge({ tag, onRemove }: Props) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="hover:text-teal-900 leading-none"
          aria-label={`${tag}を削除`}
        >
          ×
        </button>
      )}
    </span>
  )
}

function IconButton({ icon: Icon, label, title, pressed, onClick }) {
  return (
    <button
      type="button"
      className={`icon-button${pressed ? ' active' : ''}`}
      title={title ?? label}
      aria-label={title ?? label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
      {label && <span>{label}</span>}
    </button>
  )
}

export default IconButton

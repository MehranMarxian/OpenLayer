type TextAreaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function TextArea({ label, value, onChange, placeholder, disabled }: TextAreaProps) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <textarea
        className="textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}

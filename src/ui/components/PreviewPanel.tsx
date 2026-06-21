type PreviewPanelProps = {
  imageUrl: string;
};

export function PreviewPanel({ imageUrl }: PreviewPanelProps) {
  return (
    <div className="preview-panel">
      {imageUrl ? <img src={imageUrl} alt="Generated OpenLayer preview" /> : <span className="preview-empty">No result yet</span>}
    </div>
  );
}

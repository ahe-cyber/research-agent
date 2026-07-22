interface EditorRawViewProps {
  value: unknown;
}

export function EditorRawView({ value }: EditorRawViewProps) {
  return (
    <div className="page-view editor-raw-view">
      <pre className="editor-raw-view__content">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

import { withBasePath } from "@/lib/basePath";
import { EditorActionsMenu } from "./EditorActionsMenu";

interface EditorRawViewProps {
  value: unknown;
}

export function EditorRawView({ value }: EditorRawViewProps) {
  const rawLines = JSON.stringify(value, null, 2).split("\n");

  return (
    <div className="page-view editor-raw-view">
      <EditorActionsMenu viewIconSrc={withBasePath("/assets/raw.svg")} viewLabel="Raw View" />
      <div className="editor-raw-view__content" role="textbox" aria-label="Raw JSON" aria-readonly="true">
        {rawLines.map((line, index) => (
          <RawJsonLine key={`${index}-${line}`} line={line} />
        ))}
      </div>
    </div>
  );
}

function RawJsonLine({ line }: { line: string }) {
  const match = line.match(/^(\s*)("[^"]+":\s)?(.*)$/);
  const indent = match?.[1] ?? "";
  const keyPrefix = match?.[2] ?? "";
  const value = match?.[3] ?? line;

  return (
    <div className="editor-raw-view__line">
      {indent && <span className="editor-raw-view__indent">{indent}</span>}
      {keyPrefix && <span className="editor-raw-view__key">{keyPrefix}</span>}
      <span className="editor-raw-view__value">{value || " "}</span>
    </div>
  );
}

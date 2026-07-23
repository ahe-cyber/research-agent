import { withBasePath } from "@/lib/basePath";
import { EditorActionsMenu } from "./EditorActionsMenu";

interface EditorRawViewProps {
  value: unknown;
}

export function EditorRawView({ value }: EditorRawViewProps) {
  return (
    <div className="page-view editor-raw-view">
      <EditorActionsMenu viewIconSrc={withBasePath("/assets/raw.svg")} viewLabel="Raw View" />
      <pre className="editor-raw-view__content">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

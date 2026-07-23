import { useMemo, useState } from "react";
import { withBasePath } from "@/lib/basePath";
import { markdownToHtml } from "@/lib/markdown";
import { EditorActionsMenu } from "./EditorActionsMenu";

export interface EditorRichField {
  key: string;
  label: string;
  rich?: boolean;
  multiline?: boolean;
  readonly?: boolean;
}

interface EditorRichViewProps {
  value: Record<string, unknown>;
  fields: readonly EditorRichField[];
  onSave?: (value: Record<string, unknown>) => Promise<unknown>;
}

export function EditorRichView({ value, fields, onSave }: EditorRichViewProps) {
  const [mode, setMode] = useState<"rich" | "raw">("rich");
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...value });
  const [rawText, setRawText] = useState(() => JSON.stringify(value, null, 2));
  const [status, setStatus] = useState("");

  const richFields = useMemo(() => fields.filter((field) => field.rich), [fields]);

  function setFieldValue(key: string, nextValue: string) {
    setDraft((current) => {
      const next = { ...current, [key]: nextValue };
      setRawText(JSON.stringify(next, null, 2));
      return next;
    });
  }

  function switchMode(nextMode: "rich" | "raw") {
    if (nextMode === "rich") {
      try {
        setDraft(JSON.parse(rawText));
        setStatus("");
      } catch {
        setStatus("Raw JSON is invalid.");
        return;
      }
    } else {
      setRawText(JSON.stringify(draft, null, 2));
    }
    setMode(nextMode);
  }

  async function save() {
    let payload = draft;
    if (mode === "raw") {
      try {
        payload = JSON.parse(rawText);
        setDraft(payload);
      } catch {
        setStatus("Raw JSON is invalid.");
        return;
      }
    }

    try {
      setStatus("Saving...");
      await onSave?.(payload);
      setStatus("Saved");
    } catch (error) {
      console.error("[EditorRichView] Save failed", error);
      setStatus("Save failed");
    }
  }

  return (
    <div className="page-view editor-rich-view">
      <EditorActionsMenu
        viewIconSrc={withBasePath(mode === "rich" ? "/assets/code.svg" : "/assets/raw.svg")}
        viewLabel={mode === "rich" ? "Rich View" : "Raw View"}
        right={(
          <>
            <button className="record-action" type="button" onClick={() => switchMode(mode === "rich" ? "raw" : "rich")}>
              {mode === "rich" ? "Raw" : "Rich"}
            </button>
            <button className="record-action" type="button" onClick={save}>
              Save
            </button>
            <span className="editor-rich-status">{status}</span>
          </>
        )}
      />
      {mode === "raw" ? (
        <textarea
          className="editor-rich-raw"
          value={rawText}
          spellCheck={false}
          onChange={(event) => setRawText(event.target.value)}
        />
      ) : (
        <div className="editor-rich-form">
          {fields.map((field) => {
            const fieldValue = String(draft[field.key] ?? "");
            return (
              <label className={`editor-rich-field${field.rich ? " editor-rich-field-rich" : ""}`} key={field.key}>
                <span>{field.label}</span>
                {field.rich ? (
                  <>
                    <div className="editor-rich-mini-menu">
                      <img src={withBasePath("/assets/code.svg")} alt="" aria-hidden="true" />
                    </div>
                    <textarea
                      value={fieldValue}
                      spellCheck={false}
                      onChange={(event) => setFieldValue(field.key, event.target.value)}
                    />
                    <div
                      className="editor-rich-preview"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(fieldValue) }}
                    />
                  </>
                ) : field.multiline ? (
                  <textarea
                    value={fieldValue}
                    readOnly={field.readonly}
                    onChange={(event) => setFieldValue(field.key, event.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    value={fieldValue}
                    readOnly={field.readonly}
                    onChange={(event) => setFieldValue(field.key, event.target.value)}
                  />
                )}
              </label>
            );
          })}
          {richFields.length === 0 && (
            <p className="map-empty-note">No rich fields are defined for this schema.</p>
          )}
        </div>
      )}
    </div>
  );
}

import { Fragment, useEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/basePath";
import type { EditorField } from "@/lib/editorSchema";
import { markdownToHtml } from "@/lib/markdown";
import { loadWorkspaceSettings } from "@/lib/workspaceSettings";
import type { WorkspaceFeatureInvalidation } from "@/lib/workspaceInvalidation";
import { EditorActionsMenu } from "./EditorActionsMenu";

type EditorJsonMode = "raw" | "edit" | "list" | "table" | "graph";

type EditorJsonViewProps = {
  featureId?: string;
  fields?: readonly EditorField[];
  initialMode?: "raw" | "rich";
  invalidation?: WorkspaceFeatureInvalidation;
  onSave?: (value: unknown) => Promise<unknown> | unknown;
  reload?: () => Promise<unknown>;
  target?: string;
  value: unknown;
};

const viewButtons = [
  { mode: "raw", label: "Raw", icon: "/assets/raw.svg" },
  { mode: "list", label: "List", icon: "/assets/list.svg" },
  { mode: "table", label: "Table", icon: "/assets/table.svg" },
  { mode: "graph", label: "Graph", icon: "/assets/graph.svg" }
] as const;

export const EditorJsonView = ({ featureId, fields = [], initialMode = "raw", invalidation, onSave, reload, target = "item", value }: EditorJsonViewProps) => {
  const initialStructuredValue = getStructuredValue(value);
  const initialJsonMode = initialMode === "rich" ? "edit" : "raw";
  const lastInvalidationKeyRef = useRef<string | null>(null);
  const [mode, setMode] = useState<EditorJsonMode>(initialStructuredValue ? initialJsonMode : "raw");
  const [draft, setDraft] = useState<unknown>(initialStructuredValue ?? {});
  const [rawText, setRawText] = useState(() => JSON.stringify(value, null, 2));
  const [editorFields, setEditorFields] = useState<readonly EditorField[]>(fields);
  const [status, setStatus] = useState("");
  const support = getViewSupport(draft);

  useEffect(() => {
    const nextStructuredValue = getStructuredValue(value);
    setDraft(nextStructuredValue ?? {});
    setRawText(JSON.stringify(value, null, 2));
  }, [value]);

  useEffect(() => {
    setEditorFields(fields);
  }, [fields]);

  useEffect(() => {
    if (!featureId) return;

    let cancelled = false;
    fetch(withBasePath(`/api/${featureId}?resource=schema&target=${target}`))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.fields)) return;
        setEditorFields(data.fields);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [featureId, target]);

  useEffect(() => {
    const invalidationKey = `${invalidation?.info ?? 0}:${invalidation?.detail ?? 0}`;
    if (lastInvalidationKeyRef.current === null) {
      lastInvalidationKeyRef.current = invalidationKey;
      return;
    }
    if (lastInvalidationKeyRef.current === invalidationKey || !reload) return;

    lastInvalidationKeyRef.current = invalidationKey;
    let cancelled = false;
    reload()
      .then((nextValue) => {
        if (cancelled || nextValue === undefined) return;
        const nextStructuredValue = getStructuredValue(nextValue);
        setDraft(nextStructuredValue ?? {});
        setRawText(JSON.stringify(nextValue, null, 2));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [invalidation?.detail, invalidation?.info, reload]);

  const showRawView = () => {
    setRawText(JSON.stringify(draft, null, 2));
    setMode("raw");
    setStatus("");
  };

  const showJsonView = (nextMode: Exclude<EditorJsonMode, "raw">) => {
    try {
      const parsed = JSON.parse(rawText);
      const nextDraft = getStructuredValue(parsed);
      if (!nextDraft) {
        setStatus("This view needs a JSON object or array.");
        return;
      }
      setDraft(nextDraft);
      setMode(nextMode);
      setStatus("");
    } catch {
      setStatus("Raw JSON is invalid.");
    }
  };

  const setFieldValue = (key: string, nextValue: unknown) => {
    setDraft((current) => {
      const currentObject = getObjectDraft(current) ?? {};
      const next = { ...currentObject, [key]: nextValue };
      setRawText(JSON.stringify(next, null, 2));
      return next;
    });
  };

  const setArrayFieldValue = (index: number, key: string, nextValue: unknown) => {
    setDraft((current) => {
      const currentArray = Array.isArray(current) ? current : [];
      const currentObject = getObjectDraft(currentArray[index]) ?? {};
      const next = currentArray.map((item, itemIndex) => itemIndex === index ? { ...currentObject, [key]: nextValue } : item);
      setRawText(JSON.stringify(next, null, 2));
      return next;
    });
  };

  const addArrayRecord = () => {
    setDraft((current) => {
      const currentArray = Array.isArray(current) ? current : [];
      const next = [...currentArray, createEmptyRecord(editorFields, currentArray.length)];
      setRawText(JSON.stringify(next, null, 2));
      return next;
    });
  };

  const save = async () => {
    let payload: unknown = getSavePayload(draft);
    if (mode === "raw") {
      try {
        const parsed = JSON.parse(rawText);
        payload = getSavePayload(parsed);
        if (payload === null) {
          setStatus("Save needs a JSON object or array.");
          return;
        }
        setDraft(payload);
      } catch {
        setStatus("Raw JSON is invalid.");
        return;
      }
    }

    if (payload === null) {
      setStatus("Save needs a JSON object or array.");
      return;
    }

    try {
      setStatus("Saving...");
      await onSave?.(payload);
      setStatus("Saved");
    } catch (error) {
      console.error("[EditorJsonView] Save failed", error);
      setStatus("Save failed");
    }
  };

  return (
    <div className={`page-view editor-json-view editor-json-view-${mode}`}>
      <EditorActionsMenu
        left={(
          <Fragment>
            {viewButtons.map((button) => (
              <ViewButton
                active={mode === button.mode}
                disabled={button.mode !== "raw" && !support[button.mode]}
                icon={button.icon}
                key={button.mode}
                label={button.label}
                onClick={button.mode === "raw" ? showRawView : () => showJsonView(button.mode)}
              />
            ))}
          </Fragment>
        )}
        right={(
          <Fragment>
            <ViewButton active={mode === "edit"} disabled={!support.edit} icon="/assets/edit.svg" label="Edit" onClick={() => showJsonView("edit")} />
            {onSave && (
              <button className="record-action" type="button" onClick={save}>
                Save
              </button>
            )}
            {status && <span className="editor-rich-status">{status}</span>}
          </Fragment>
        )}
      />
      {mode === "raw" && (
        <RawJsonBody rawText={rawText} editable={support.edit} setRawText={setRawText} />
      )}
      {mode === "edit" && (
        <EditorFormBody
          addArrayRecord={addArrayRecord}
          draft={draft}
          fields={editorFields}
          setArrayFieldValue={setArrayFieldValue}
          setFieldValue={setFieldValue}
        />
      )}
      {mode === "list" && <ListJsonBody value={draft} />}
      {mode === "table" && <TableJsonBody value={draft} />}
      {mode === "graph" && <GraphJsonBody value={draft} />}
    </div>
  );
};

const ViewButton = ({ active, disabled = false, icon, label, onClick }: { active: boolean; disabled?: boolean; icon: string; label: string; onClick: () => void }) => {
  return (
    <button className="record-action editor-view-action" type="button" aria-pressed={active} disabled={disabled} title={label} aria-label={`${label} view`} onClick={onClick}>
      <img src={withBasePath(icon)} alt="" aria-hidden="true" />
    </button>
  );
};

const RawJsonBody = ({ editable, rawText, setRawText }: { editable: boolean; rawText: string; setRawText: (value: string) => void }) => {
  if (editable) {
    return (
      <textarea
        className="editor-rich-raw"
        value={rawText}
        spellCheck={false}
        onChange={(event) => setRawText(event.target.value)}
      />
    );
  }

  return (
    <div className="editor-raw-view__content" role="textbox" aria-label="Raw JSON" aria-readonly="true">
      {rawText.split("\n").map((line, index) => (
        <RawJsonLine key={`${index}-${line}`} line={line} />
      ))}
    </div>
  );
};

type EditorFormBodyProps = {
  addArrayRecord: () => void;
  draft: unknown;
  fields: readonly EditorField[];
  setArrayFieldValue: (index: number, key: string, nextValue: unknown) => void;
  setFieldValue: (key: string, nextValue: unknown) => void;
};

const EditorFormBody = ({ addArrayRecord, draft, fields, setArrayFieldValue, setFieldValue }: EditorFormBodyProps) => {
  const draftObject = getObjectDraft(draft);
  const effectiveFields = fields.length > 0 ? fields : getFieldsFromValue(draft);

  if (Array.isArray(draft)) {
    return (
      <div className="editor-rich-form">
        {draft.map((item, index) => (
          <section className="editor-array-record" key={getRowKey(getObjectDraft(item) ?? {}, index)}>
            <h3>{getArrayRecordLabel(item, index)}</h3>
            <EditorFieldsForm fields={effectiveFields} value={getObjectDraft(item) ?? {}} setFieldValue={(key, nextValue) => setArrayFieldValue(index, key, nextValue)} />
          </section>
        ))}
        <div className="editor-array-actions">
          <button className="record-action" type="button" onClick={addArrayRecord}>
            Add Record
          </button>
        </div>
      </div>
    );
  }
  if (!draftObject) return <p className="map-empty-note">Edit view needs a JSON object or array.</p>;

  return (
    <div className="editor-rich-form">
      <EditorFieldsForm fields={effectiveFields} value={draftObject} setFieldValue={setFieldValue} />
    </div>
  );
};

const EditorFieldsForm = ({ fields, setFieldValue, value }: { fields: readonly EditorField[]; setFieldValue: (key: string, nextValue: unknown) => void; value: Record<string, unknown> }) => {
  const secretOptions = getSecretSettingOptions();

  return (
    <Fragment>
      {fields.map((field) => {
        const fieldValue = formatFieldValue(value[field.key]);
        return (
          <label className={`editor-rich-field${field.rich ? " editor-rich-field-rich" : ""}`} key={field.key}>
            <span>{field.label}</span>
            {field.rich ? (
              <Fragment>
                <div className="editor-rich-mini-menu">
                  <img src={withBasePath("/assets/code.svg")} alt="" aria-hidden="true" />
                </div>
                <textarea value={fieldValue} spellCheck={false} onChange={(event) => setFieldValue(field.key, event.target.value)} />
                <div className="editor-rich-preview" dangerouslySetInnerHTML={{ __html: markdownToHtml(fieldValue) }} />
              </Fragment>
            ) : field.control === "checkbox" ? (
              <input type="checkbox" checked={Boolean(value[field.key])} disabled={field.readonly} onChange={(event) => setFieldValue(field.key, event.target.checked)} />
            ) : field.control === "secretDropdown" ? (
              <select value={fieldValue} disabled={field.readonly} onChange={(event) => setFieldValue(field.key, event.target.value)}>
                <option value="">Select secret</option>
                {secretOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.name}
                  </option>
                ))}
              </select>
            ) : field.control === "secretValue" ? (
              <input type={value.secret ? "password" : "text"} value={fieldValue} readOnly={field.readonly} onChange={(event) => setFieldValue(field.key, event.target.value)} />
            ) : field.multiline ? (
              <textarea value={fieldValue} readOnly={field.readonly} onChange={(event) => setFieldValue(field.key, event.target.value)} />
            ) : (
              <input type="text" value={fieldValue} readOnly={field.readonly} onChange={(event) => setFieldValue(field.key, event.target.value)} />
            )}
          </label>
        );
      })}
    </Fragment>
  );
};

const ListJsonBody = ({ value }: { value: unknown }) => {
  const rows = Array.isArray(value) ? value : Object.entries(getObjectDraft(value) ?? {}).map(([name, item]) => ({ id: name, name, value: item }));
  return (
    <div className="page-view-content page-list-view-content">
      {rows.map((item, index) => {
        const itemObject = getObjectDraft(item);
        return (
          <article className="editor-json-list-item" key={itemObject?.id ? String(itemObject.id) : index}>
            <strong>{itemObject?.name ? String(itemObject.name) : `Item ${index + 1}`}</strong>
            <pre>{formatGenericValue(item)}</pre>
          </article>
        );
      })}
    </div>
  );
};

const TableJsonBody = ({ value }: { value: unknown }) => {
  const rows = getTableRows(value);
  const columns = getTableColumns(rows);
  return (
    <div className="page-view-content page-table-view-content">
      <table className="editor-json-table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={getRowKey(row, rowIndex)}>
              {columns.map((column) => <td key={column}>{formatTableCell(row[column])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const GraphJsonBody = ({ value }: { value: unknown }) => {
  return (
    <div className="page-view-content page-graph-view-content">
      <JsonGraphNode name="root" value={value} />
    </div>
  );
};

const JsonGraphNode = ({ name, value }: { name: string; value: unknown }) => {
  const objectValue = getObjectDraft(value);
  const children = Array.isArray(value)
    ? value.map((item, index) => [`${index}`, item] as const)
    : Object.entries(objectValue ?? {});

  return (
    <div className="editor-json-graph-node">
      <strong>{name}</strong>
      {children.length > 0 ? (
        <div className="editor-json-graph-children">
          {children.map(([childName, childValue]) => (
            <JsonGraphNode key={childName} name={childName} value={childValue} />
          ))}
        </div>
      ) : (
        <span>{formatTableCell(value)}</span>
      )}
    </div>
  );
};

const RawJsonLine = ({ line }: { line: string }) => {
  const match = line.match(/^(\s*)("[^"]+":\s)?(.*)$/);
  const indent = match?.[1] ?? "";
  const keyPrefix = match?.[2] ?? "";
  const lineValue = match?.[3] ?? line;

  return (
    <div className="editor-raw-view__line">
      {indent && <span className="editor-raw-view__indent">{indent}</span>}
      {keyPrefix && <span className="editor-raw-view__key">{keyPrefix}</span>}
      <span className="editor-raw-view__value">{lineValue || " "}</span>
    </div>
  );
};

const getViewSupport = (value: unknown) => {
  const structured = getStructuredValue(value) !== null;
  return {
    edit: structured,
    list: structured,
    table: getTableRows(value).length > 0,
    graph: structured
  };
};

const getTableRows = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.map(getObjectDraft).filter((item): item is Record<string, unknown> => Boolean(item));
  const objectValue = getObjectDraft(value);
  return objectValue ? Object.entries(objectValue).map(([key, item]) => ({ key, value: item })) : [];
};

const getTableColumns = (rows: Record<string, unknown>[]) => {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
};

const getRowKey = (row: Record<string, unknown>, index: number) => {
  return typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : String(index);
};

const getObjectDraft = (value: unknown) => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : null;
};

const getStructuredValue = (value: unknown) => {
  if (Array.isArray(value)) return value;
  return getObjectDraft(value);
};

const getSavePayload = (value: unknown) => {
  if (Array.isArray(value)) return value;
  return getObjectDraft(value);
};

const createEmptyRecord = (fields: readonly EditorField[], index: number) => {
  const id = createRecordId();
  const record = fields.reduce<Record<string, unknown>>((next, field) => {
    next[field.key] = field.key === "id" ? id : field.control === "checkbox" ? false : "";
    return next;
  }, {});
  return Object.keys(record).length > 0 ? record : { id, name: "" };
};

const createRecordId = () => {
  return globalThis.crypto?.randomUUID?.() || `new-record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getFieldsFromValue = (value: unknown): readonly EditorField[] => {
  if (Array.isArray(value)) {
    const keys = Array.from(new Set(value.flatMap((item) => Object.keys(getObjectDraft(item) ?? {}))));
    return keys.map((key) => ({ key, label: key, multiline: true }));
  }

  return Object.keys(getObjectDraft(value) ?? {}).map((key) => ({ key, label: key, multiline: true }));
};

const formatGenericValue = (value: unknown) => {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
};

const formatFieldValue = (value: unknown) => {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
};

const formatTableCell = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
};

const getArrayRecordLabel = (item: unknown, index: number) => {
  const itemObject = getObjectDraft(item);
  return String(itemObject?.name || itemObject?.id || `Record ${index + 1}`);
};

const getSecretSettingOptions = () => {
  const settings = loadWorkspaceSettings();
  return Array.isArray(settings)
    ? settings
      .filter((setting: any) => setting?.secret && typeof setting?.key === "string")
      .map((setting: any) => ({ key: setting.key, name: setting.name || setting.key }))
    : [];
};

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import "./Primitives.module.css";
import { getFeatureLabel, type FeatureName } from "@/lib/features";
import { withBasePath } from "@/lib/basePath";

type SearchWidgetProps = {
  featureId: FeatureName;
  selectedSourceId: string;
  accessToken?: string;
};

type SearchSuggestion = {
  id: string;
  name: string;
  description?: string;
};

export const SearchWidget = ({ featureId, selectedSourceId, accessToken = "" }: SearchWidgetProps) => {
  const featureLabel = getFeatureLabel(featureId);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [status, setStatus] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestTokenRef = useRef(0);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (suggestions[0]) void retrieveSuggestion(suggestions[0]);
  };

  useEffect(() => {
    if (!focused) return;
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSuggestions([]);
      setStatus("");
      return;
    }

    const requestToken = ++requestTokenRef.current;
    const timeout = window.setTimeout(() => {
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const params = buildSearchParams({
        sourceId: selectedSourceId,
        query: trimmedQuery,
        accessToken,
        sessionToken: getSessionToken()
      });
      setStatus("Loading");
      fetch(withBasePath(`/api/${featureId}?resource=suggest&${params}`), { signal: abortController.signal })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (requestToken !== requestTokenRef.current) return;
          if (!response.ok) {
            setSuggestions([]);
            setStatus(typeof data.error === "string" ? data.error : "Suggestion search failed.");
            return;
          }
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
          setStatus("");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (requestToken !== requestTokenRef.current) return;
          setSuggestions([]);
          setStatus("Suggestion search failed.");
        });
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      abortControllerRef.current?.abort();
    };
  }, [accessToken, featureId, focused, query, selectedSourceId, sessionToken]);

  function getSessionToken() {
    if (sessionToken) return sessionToken;
    const nextSessionToken = crypto.randomUUID();
    setSessionToken(nextSessionToken);
    return nextSessionToken;
  }

  async function retrieveSuggestion(suggestion: SearchSuggestion) {
    const params = buildSearchParams({
      sourceId: selectedSourceId,
      id: suggestion.id,
      accessToken,
      sessionToken: getSessionToken()
    });

    setStatus("Loading");
    try {
      const response = await fetch(withBasePath(`/api/${featureId}?resource=retrieve&${params}`));
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Suggestion retrieve failed.");
        return;
      }
      setQuery(suggestion.name);
      setStatus("");
      setSuggestions([]);
      setSessionToken("");
      window.dispatchEvent(new CustomEvent("research-agent:search-suggestion-retrieved", {
        detail: { featureId, sourceId: selectedSourceId, suggestion, item: data.item }
      }));
    } catch {
      setStatus("Suggestion retrieve failed.");
    }
  }

  return (
    <div className="search-box-shell search-widget-shell">
      <input
        className="search-widget-input"
        type="search"
        name={`${featureId}-query`}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-autocomplete="list"
        data-lpignore="true"
        data-1p-ignore="true"
        placeholder={`Search ${featureLabel.toLowerCase()}`}
        value={query}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setFocused(false), 120);
        }}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {focused && (suggestions.length > 0 || status) && (
        <div className="search-widget-results">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              className="search-widget-result"
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                void retrieveSuggestion(suggestion);
              }}
            >
              <span>
                <strong>{suggestion.name}</strong>
                {suggestion.description && <span>{suggestion.description}</span>}
              </span>
            </button>
          ))}
          {status && (
            <div className="search-widget-result search-widget-result-status">
              <span>{status}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function buildSearchParams({
  sourceId,
  query,
  id,
  accessToken,
  sessionToken
}: {
  sourceId: string;
  query?: string;
  id?: string;
  accessToken?: string;
  sessionToken?: string;
}) {
  const params = new URLSearchParams();
  params.set("source", sourceId);
  if (query) params.set("q", query);
  if (id) params.set("id", id);
  if (accessToken) params.set("access_token", accessToken);
  if (sessionToken) params.set("session_token", sessionToken);
  params.set("limit", "6");
  return params;
}

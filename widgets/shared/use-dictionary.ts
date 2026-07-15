import { Dictionary } from "@tago-io/sdk";
import { useUserInformation } from "@tago-io/custom-widget-react";
import { useEffect, useMemo, useState } from "react";

type Translations = Record<string, string>;

interface UseDictionaryOptions {
  /**
   * English (or any other) baseline used while the SDK round-trip is in
   * flight and as a fallback when the SDK call fails. Without it, the
   * widget would render raw key names (e.g. `WIDGET_TEMPERATURE`) on
   * first paint.
   */
  baseline?: Translations;
}

/**
 * Resolves a fixed set of `VAL.*` dictionary keys against the user's
 * current language via the TagoIO SDK. The hook pre-fetches every key on
 * mount and exposes a synchronous `t(key, params?)` for rendering.
 *
 * The `keys` argument MUST be a stable reference (declared at module
 * scope as `as const`) — the effect dependency is identity-based.
 */
export function useDictionary(keys: readonly string[], options: UseDictionaryOptions = {}) {
  const { token, language, runURL } = useUserInformation();
  const [translations, setTranslations] = useState<Translations>(options.baseline ?? {});

  useEffect(() => {
    if (!token || !language || !runURL || keys.length === 0) {
      return;
    }
    const dict = new Dictionary({ token, language, runURL });
    let cancelled = false;
    Promise.all(keys.map((key) => dict.applyToString(`#VAL.${key}#`)))
      .then((values) => {
        if (cancelled) {
          return;
        }
        const next: Translations = { ...(options.baseline ?? {}) };
        keys.forEach((key, index) => {
          const resolved = values[index];
          // When the dictionary doesn't exist on the account, or the key
          // is missing, the SDK returns the placeholder unchanged
          // (`#VAL.KEY#`). Keep the baseline in that case so the widget
          // doesn't render raw placeholders.
          if (resolved && !resolved.includes(`#VAL.${key}#`)) {
            next[key] = resolved;
          }
        });
        setTranslations(next);
      })
      .catch(() => {
        // Network/SDK failure: keep the baseline. The widget stays usable.
      });
    return () => {
      cancelled = true;
    };
  }, [token, language, runURL, keys, options.baseline]);

  const t = useMemo(() => {
    return (key: string, params?: Record<string, string | number>) => {
      const raw = translations[key] ?? key;
      if (!params) {
        return raw;
      }
      return Object.entries(params).reduce(
        (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
        raw,
      );
    };
  }, [translations]);

  return { t };
}

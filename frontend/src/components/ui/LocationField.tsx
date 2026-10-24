"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { searchPlaces } from "@/lib/places";

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

interface LocationFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | undefined;
}

// A text input with place suggestions as you type. Anything typed is accepted as-is; picking a
// suggestion just saves typing "City, Region, Country" in full.
export function LocationField({ label, value, onChange, onBlur, error }: LocationFieldProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  // Set when a suggestion is chosen, so the follow-up value change does not search again.
  const skipSearch = useRef(false);

  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }
    const query = value.trim();
    if (query.length < MIN_QUERY) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchPlaces(query, controller.signal)
        .then((places) => {
          setResults(places);
          setActive(-1);
        })
        .catch(() => {
          // Aborted or offline: no suggestions, and typing still works.
          if (!controller.signal.aborted) setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const choose = (place: string) => {
    skipSearch.current = true;
    onChange(place);
    setResults([]);
    setOpen(false);
    setActive(-1);
  };

  // Results from a longer, earlier query are hidden as soon as the text gets too short.
  const suggestions = value.trim().length >= MIN_QUERY ? results : [];
  const expanded = open && suggestions.length > 0;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && expanded && active >= 0) {
      // Pick the highlighted place instead of submitting the form.
      event.preventDefault();
      const place = suggestions[active];
      if (place) choose(place);
    } else if (event.key === "Escape" && expanded) {
      // Close the list only; the dialog's own Escape handling should not fire.
      event.nativeEvent.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-300">
        {label}
      </label>
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        >
          <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
        </svg>
        <input
          id={id}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          autoComplete="off"
          placeholder="Search a city, region or country"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Options use onMouseDown, so a click lands before this runs.
            setOpen(false);
            onBlur?.();
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "block w-full rounded-xl border-0 bg-white/6 py-2.5 pr-10 pl-10 text-sm text-white ring-1 ring-inset placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:outline-none",
            error ? "ring-red-400/60 focus:ring-red-400" : "ring-white/15 focus:ring-orange-400",
          )}
        />
        {searching && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-orange-400"
          />
        )}
      </div>

      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl bg-slate-900 p-1.5 shadow-2xl ring-1 ring-white/15"
        >
          {suggestions.map((place, index) => (
            <li
              key={place}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(place);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "cursor-pointer rounded-xl px-3 py-2 text-sm text-slate-200",
                index === active && "bg-white/10 text-white",
              )}
            >
              {place}
            </li>
          ))}
          <li aria-hidden="true" className="px-3 pt-1.5 pb-1 text-[11px] text-slate-500">
            Suggestions from OpenStreetMap
          </li>
        </ul>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

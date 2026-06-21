import { useState } from 'react';
import { DOCUMENT_LIBRARY } from '../data/documentLibrary.js';

/**
 * Static form reference browser — no network calls, no backend, no advice language.
 */
export default function DocumentLibrary() {
  const [selectedId, setSelectedId] = useState(DOCUMENT_LIBRARY[0]?.id ?? '');

  const selected = DOCUMENT_LIBRARY.find((d) => d.id === selectedId);

  return (
    <section className="card document-library" aria-label="Immigration form reference">
      <h2>Form reference</h2>
      <p className="hint">
        General descriptions of common immigration documents and forms often seen together. For background
        only — not legal advice and not a filing checklist for any individual case.
      </p>

      <div className="doc-lib-layout">
        <ul className="doc-lib-list" role="listbox" aria-label="Document types">
          {DOCUMENT_LIBRARY.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                role="option"
                aria-selected={doc.id === selectedId}
                className={doc.id === selectedId ? 'doc-lib-item active' : 'doc-lib-item'}
                onClick={() => setSelectedId(doc.id)}
              >
                <span className="doc-lib-code">{doc.code}</span>
                <span className="doc-lib-title">{doc.title}</span>
              </button>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="doc-lib-detail">
            <h3>
              {selected.code} — {selected.title}
            </h3>
            <p className="doc-lib-agency">{selected.agency}</p>
            <p className="doc-lib-description">{selected.description}</p>

            <h4>Commonly associated documents</h4>
            <p className="hint doc-lib-related-intro">
              These items appear together in many cases — listed for general reference, not as instructions for
              any particular person.
            </p>
            <ul className="doc-lib-related">
              {selected.relatedForms.map((rel) => (
                <li key={`${rel.code}-${rel.title}`}>
                  <strong>{rel.code !== '—' ? rel.code : rel.title}</strong>
                  {rel.code !== '—' && <> — {rel.title}</>}
                  <p className="doc-lib-related-note">{rel.note}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

#!/usr/bin/env python3
"""Log redaction.recall CODE annotations on passage.translate spans in Phoenix."""
from __future__ import annotations

import json
import sys

import httpx
from phoenix.client import Client


def fetch_translate_spans(base_url: str) -> list[dict]:
    q = """
    query {
      projects(first: 10) {
        edges {
          node {
            name
            spans(first: 50, sort: {col: startTime, dir: desc}) {
              edges {
                node { name spanId attributes startTime }
              }
            }
          }
        }
      }
    }
    """
    r = httpx.post(f"{base_url}/graphql", json={"query": q}, timeout=60)
    r.raise_for_status()
    data = r.json()
    if data.get("errors"):
        raise RuntimeError(data["errors"])

    spans: list[dict] = []
    for pe in data["data"]["projects"]["edges"]:
        if pe["node"]["name"] != "passage":
            continue
        for se in pe["node"]["spans"]["edges"]:
            n = se["node"]
            if n["name"] != "passage.translate":
                continue
            attrs = n.get("attributes") or {}
            if isinstance(attrs, str):
                attrs = json.loads(attrs)
            red = attrs.get("redaction") or {}
            if not red.get("doc_id"):
                continue
            spans.append(
                {
                    "span_id": n["spanId"],
                    "start_time": n["startTime"],
                    "doc_id": red.get("doc_id"),
                    "recall": float(red.get("recall", 0)),
                    "matched": int(red.get("matched_spans", 0)),
                    "total": int(red.get("total_spans", 0)),
                }
            )
    spans.sort(key=lambda s: s["start_time"])
    return spans


def main() -> None:
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:6006"
    client = Client(base_url=base_url)
    spans = fetch_translate_spans(base_url)

    if not spans:
        print("No passage.translate spans with redaction attributes found.")
        sys.exit(1)

    annotations = []
    for s in spans:
        annotations.append(
            {
                "span_id": s["span_id"],
                "name": "redaction.recall",
                "annotator_kind": "CODE",
                "result": {
                    "score": s["recall"],
                    "label": f"{round(s['recall'] * 100)}%",
                    "explanation": f"{s['matched']}/{s['total']} true spans recalled ({s['doc_id']})",
                },
                "metadata": {
                    "doc_id": s["doc_id"],
                    "matched": s["matched"],
                    "total": s["total"],
                },
            }
        )

    client.spans.log_span_annotations(span_annotations=annotations, sync=True)
    print(f"Logged {len(annotations)} redaction.recall annotations to Phoenix")

    for s in spans:
        print(
            f"  {s['doc_id']}: {s['recall']*100:.1f}% "
            f"({s['matched']}/{s['total']}) span={s['span_id'][:12]}…"
        )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Enrich unified_vocab.json with HSK-constrained example sentences (3-10 characters)
using OpenAI gpt-4o-mini and Structured Outputs.
"""

import json
import os
import re
import sys
import time
from openai import OpenAI
from pydantic import BaseModel, Field

# --- CONFIGURATION ---
INPUT_FILE = "unified_vocab.json"
OUTPUT_FILE = "unified_vocab_enriched.json"
MODEL_NAME = "gpt-4o-mini"
DRY_RUN_LIMIT = None  # Set to None to run the full deck, or an integer (e.g. 5) to test
CHECKPOINT_INTERVAL = 10

api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    print("Error: OPENAI_API_KEY is not set.")
    print("Run: export OPENAI_API_KEY=\"your_key_here\" before starting.")
    sys.exit(1)

client = OpenAI(api_key=api_key)


class SentencePayload(BaseModel):
    cn: str = Field(description="Natural Chinese sentence, 3-10 characters total, containing the target word.")
    pinyin: str = Field(description="Full pinyin with tone marks matching the sentence.")
    en: str = Field(description="Concise, natural English translation.")


SYSTEM_PROMPT = """You are a specialist Chinese pedagogue designing sentences for a handwriting training app.
Generate a single, natural, colloquial Chinese example sentence for the given target word.

STRICT RULES:
1. Target Word: Must include the target word exactly as written.
2. Length: Strictly between 3 and 10 Chinese characters long (excluding punctuation). Aim for 4-8 characters.
3. Vocabulary Constraint: All other characters in the sentence must be at or below the target word's HSK level. Never use obscure or literary words.
4. Naturalness: Modern, everyday speech.
"""


def count_hanzi(text: str) -> int:
    """Counts only Chinese glyphs, excluding punctuation, numbers, and spaces."""
    return len(re.findall(r"[\u4e00-\u9fff]", text))


def generate_sentence(item: dict, max_retries: int = 3) -> dict | None:
    target = item["character"]
    level = item.get("level", 1)
    prompt = f"Target word: {target}\nPinyin: {item.get('pinyin', '')}\nMeaning: {item.get('meaning', '')}\nHSK Level: {level}"

    for attempt in range(max_retries):
        try:
            completion = client.beta.chat.completions.parse(
                model=MODEL_NAME,
                temperature=0.3,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                response_format=SentencePayload,
            )

            result = completion.choices[0].message.parsed
            char_count = count_hanzi(result.cn)

            if target in result.cn and 3 <= char_count <= 10:
                return result.model_dump()

            print(f"  [Retry {attempt + 1}] Boundary check failed for {target} ('{result.cn}' -> {char_count} chars).")

        except Exception as e:
            print(f"  [Error] Request error for {target}: {e}")
            time.sleep(1.5)

    return None


def main():
    source_file = OUTPUT_FILE if os.path.exists(OUTPUT_FILE) else INPUT_FILE
    if not os.path.exists(source_file):
        print(f"Error: Could not find '{source_file}'. Ensure it is in the same directory.")
        sys.exit(1)

    print(f"Loading vocabulary from {source_file}...")
    with open(source_file, "r", encoding="utf-8") as f:
        vocab = json.load(f)

    pending_indices = [
        i for i, item in enumerate(vocab) if "example_sentence" not in item
    ]
    total_missing = len(pending_indices)

    if DRY_RUN_LIMIT:
        pending_indices = pending_indices[:DRY_RUN_LIMIT]
        print(f"=== DRY RUN MODE: Processing {len(pending_indices)} of {total_missing} items ===")
    else:
        print(f"=== FULL RUN: Processing all {total_missing} items ===")

    if not pending_indices:
        print("All items already have example sentences.")
        return

    processed = 0
    saved_since_last = 0

    try:
        for idx in pending_indices:
            item = vocab[idx]
            target = item["character"]
            processed += 1
            print(f"[{processed}/{len(pending_indices)}] {target} (HSK {item.get('level')})...", end=" ")

            sentence_data = generate_sentence(item)
            if sentence_data:
                item["example_sentence"] = sentence_data
                print(f"✓ {sentence_data['cn']} ({sentence_data['en']})")
            else:
                print("✗ Failed boundary check.")

            saved_since_last += 1
            if saved_since_last >= CHECKPOINT_INTERVAL:
                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(vocab, f, ensure_ascii=False, indent=2)
                saved_since_last = 0

    except KeyboardInterrupt:
        print("\nProcess halted by user. Saving current progress...")
    finally:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(vocab, f, ensure_ascii=False, indent=2)
        print(f"Saved progress to {OUTPUT_FILE}.")


if __name__ == "__main__":
    main()
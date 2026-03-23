"""
Cleanup script for Full Japanese Study Deck vocabulary data.
Parses messy primary_text and meaning fields, extracts clean data.
Then de-duplicates against items from cleaner sources.
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

INPUT = 'dist/data/language/vocabulary.json'
OUTPUT = 'dist/data/language/vocabulary.json'

FJSD_SOURCE = 'Full_Japanese_Study_Deck_JLPT_N5N1_vocabkanji__more.apkg'

# POS labels that appear in the meaning field
POS_PATTERNS = [
    r'^Common noun$',
    r'^Proper noun$',
    r'^Pronoun$',
    r'^Numeric$',
    r'^Counter$',
    r'^Prefix$',
    r'^Suffix$',
    r'^Adverb$',
    r'^Conjunction$',
    r'^Interjection$',
    r'^Particle$',
    r'^Auxiliary$',
    r'^Expression \(phrase, clause, etc\.\)$',
    r'^Noun or verb acting prenominally$',
    r"^Takes the aux\. verb '.*'$",
    r'^Transitive verb$',
    r'^Intransitive verb$',
    r'^Ichidan verb$',
    r'^Godan verb.*$',
    r'^Suru verb.*$',
    r'^Kuru verb.*$',
    r'^い-adjective$',
    r'^い adjective$',
    r'^な-adjective$',
    r'^な adjective$',
    r'^No-adjective$',
    r'^Adverb taking the.*$',
    r'^Wikipedia definition$',
    r'^Archaism$',
    r'^Colloquialism$',
    r'^Slang$',
    r'^Abbreviation$',
    r'^Onomatopoeic or mimetic word$',
    r'^Usually written using kana alone$',
    r'^Show other translations$',
    r"^May take the '.*' particle$",
    r'^Esp\..*$',
    r'^After .*$',
    r'^With .*$',
    r'^Often used in .*$',
    r'^Meaning restricted to .*$',
]

POS_REGEX = re.compile('|'.join(POS_PATTERNS))

# Metadata lines in primary_text to strip
METADATA_LINES = [
    'Common kanji form',
    'Common reading',
    'Show other kanji forms',
    'Show other readings',
    'Irregular okurigana usage',
    'Search-only kanji form',
    'Rarely used kanji form',
    'Irregular reading',
    'Out-dated or obsolete kana usage',
]

def clean_primary_text(text):
    """Extract just the word from the first line."""
    lines = text.split('\n')
    # First non-empty line is the word
    word = ''
    for line in lines:
        line = line.strip()
        if line:
            word = line
            break
    return word

def clean_reading(text):
    """Extract just the reading, stripping metadata."""
    if not text:
        return None
    lines = text.split('\n')
    reading = ''
    for line in lines:
        line = line.strip()
        if line and line not in METADATA_LINES:
            reading = line
            break
    # Don't return readings like "(no additional readings)"
    if reading.startswith('(') or reading == '':
        return None
    return reading

def clean_meaning(text):
    """Extract clean meanings, stripping POS labels and metadata."""
    if not text:
        return ''

    # Split on double-newline to get paragraphs
    paragraphs = re.split(r'\n\n+', text)

    meanings = []
    pos_labels = set()
    related = []

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Check if this is a POS label
        if POS_REGEX.match(para):
            # Extract the POS for the part_of_speech field
            pos = extract_pos_label(para)
            if pos:
                pos_labels.add(pos)
            continue

        # Check if this is a "Related:" entry
        if para.startswith('Related:'):
            related.append(para.replace('Related:', '').strip())
            continue

        # Skip other metadata
        if para in METADATA_LINES:
            continue

        # This is an actual meaning
        meanings.append(para)

    clean = '; '.join(meanings) if meanings else ''
    # Truncate very long meanings
    if len(clean) > 200:
        clean = clean[:197] + '...'

    return clean, pos_labels, related

def extract_pos_label(text):
    """Map a POS pattern to a clean label."""
    text = text.strip()
    if 'noun' in text.lower() and 'pronoun' not in text.lower():
        return 'noun'
    if 'pronoun' in text.lower():
        return 'pronoun'
    if text == 'Numeric' or text == 'Counter':
        return 'numeral'
    if 'Transitive verb' in text:
        return 'transitive verb'
    if 'Intransitive verb' in text:
        return 'intransitive verb'
    if 'Ichidan verb' in text:
        return 'ichidan verb'
    if 'Godan verb' in text:
        return 'godan verb'
    if 'Suru verb' in text:
        return 'suru verb'
    if text == 'Adverb' or text.startswith('Adverb taking'):
        return 'adverb'
    if 'い-adjective' in text or 'い adjective' in text:
        return 'い-adjective'
    if 'な-adjective' in text or 'な adjective' in text:
        return 'な-adjective'
    if text == 'Conjunction':
        return 'conjunction'
    if text == 'Interjection':
        return 'interjection'
    if text == 'Particle':
        return 'particle'
    if text == 'Prefix':
        return 'prefix'
    if text == 'Suffix':
        return 'suffix'
    if 'Expression' in text:
        return 'expression'
    return None

def is_fjsd(item):
    """Check if item is exclusively from FJSD."""
    decks = item.get('source_decks', [])
    return len(decks) == 1 and decks[0] == FJSD_SOURCE

def main():
    with open(INPUT, encoding='utf-8') as f:
        data = json.load(f)

    print(f'Loaded {len(data)} vocabulary items')

    fjsd_count = 0
    cleaned_count = 0

    # Build index of clean items by primary_text for dedup
    clean_index = {}  # word -> item index in data
    fjsd_indices = []  # indices of FJSD items

    for i, item in enumerate(data):
        if is_fjsd(item):
            fjsd_indices.append(i)
        else:
            clean_index[item['primary_text']] = i

    print(f'FJSD items: {len(fjsd_indices)}')
    print(f'Clean items: {len(clean_index)}')

    # Phase 1: Clean FJSD items
    for i in fjsd_indices:
        item = data[i]
        fjsd_count += 1

        orig_pt = item.get('primary_text', '')
        orig_meaning = item.get('meaning', '')

        # Clean primary_text
        new_pt = clean_primary_text(orig_pt)

        # Clean reading
        new_reading = clean_reading(item.get('reading', ''))

        # Clean meaning and extract POS
        new_meaning, pos_labels, related = clean_meaning(orig_meaning)

        # Update item
        item['primary_text'] = new_pt
        if new_reading and new_reading != new_pt:
            item['reading'] = new_reading
        elif new_reading == new_pt:
            item['reading'] = None

        item['meaning'] = new_meaning

        if pos_labels and not item.get('part_of_speech'):
            item['part_of_speech'] = ', '.join(sorted(pos_labels))

        if related and not item.get('related_items'):
            item['related_items'] = related

        # Fix item_key to match cleaned primary_text
        old_key = item.get('item_key', '')
        item['item_key'] = f'vocab:{new_pt}'

        cleaned_count += 1

    print(f'Cleaned {cleaned_count} FJSD items')

    # Phase 2: De-duplicate
    # For FJSD items that now match a clean source item, merge useful data and mark for removal
    to_remove = set()
    merged_count = 0

    for i in fjsd_indices:
        item = data[i]
        word = item['primary_text']

        if word in clean_index:
            clean_i = clean_index[word]
            clean_item = data[clean_i]

            # Upsert useful data from FJSD into clean item
            if item.get('part_of_speech') and not clean_item.get('part_of_speech'):
                clean_item['part_of_speech'] = item['part_of_speech']

            if item.get('jlpt_level') and not clean_item.get('jlpt_level'):
                clean_item['jlpt_level'] = item['jlpt_level']

            if item.get('related_items') and not clean_item.get('related_items'):
                clean_item['related_items'] = item['related_items']

            to_remove.add(i)
            merged_count += 1

    print(f'Merged {merged_count} duplicates into clean items')

    # Remove duplicates
    data = [item for i, item in enumerate(data) if i not in to_remove]

    print(f'Final count: {len(data)} items (removed {len(to_remove)} duplicates)')

    # Phase 3: Fix duplicate item_keys (multiple FJSD items might clean to the same word)
    seen_keys = {}
    key_dupes = 0
    for item in data:
        key = item.get('item_key', '')
        if key in seen_keys:
            key_dupes += 1
            item['item_key'] = f'{key}_{key_dupes}'
        else:
            seen_keys[key] = True

    if key_dupes > 0:
        print(f'Fixed {key_dupes} duplicate item_keys')

    # Write output
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f'Written to {OUTPUT}')

    # Show some samples
    print('\n--- Sample cleaned items ---')
    for item in data[:3]:
        if FJSD_SOURCE in str(item.get('source_decks', [])):
            print(f"  {item['primary_text']} | {item.get('reading')} | {item['meaning'][:60]} | POS: {item.get('part_of_speech')}")

if __name__ == '__main__':
    main()

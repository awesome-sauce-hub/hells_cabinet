#!/usr/bin/env python3
"""Round-trip the roster through a spreadsheet.

    python3 scripts/authoring/roster_xlsx.py export     -> content/roster.xlsx
    python3 scripts/authoring/roster_xlsx.py import     -> content/politicians.json

Editing 122 figures in JSON means minding commas and quotes; editing them in a
sheet means sorting by tier, filtering to the objects, and fixing forty bios in
one pass. The importer is the half that matters - it validates before it writes,
so a spreadsheet mistake fails loudly here rather than quietly at runtime.

Written against the standard library on purpose. An .xlsx is a zip of XML, and
adding a dependency to move a table around is not worth it.
"""
from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[2]
JSON_PATH = ROOT / 'content' / 'politicians.json'
XLSX_PATH = ROOT / 'content' / 'roster.xlsx'

# Order matters: it is the column order in the sheet and the key order in JSON.
COLUMNS = [
    ('id', 'id', 16),
    ('name', 'name', 24),
    ('category', 'category', 12),
    ('tier', 'tier', 14),
    ('alignment', 'alignment', 11),
    ('country', 'country', 18),
    ('era', 'era', 10),
    ('office', 'office', 26),
    ('bio', 'bio', 62),
    ('traits', 'traits (comma separated)', 30),
    ('rivals', 'rivals (comma separated ids)', 24),
    ('endsRun', 'endsRun (blank for almost everyone)', 34),
    ('reviewed', 'reviewed (TRUE/FALSE)', 14),
]
LIST_FIELDS = {'traits', 'rivals'}
OPTIONAL = {'rivals', 'endsRun', 'party'}

CATEGORIES = ['politician', 'wildcard', 'object']
TIERS = ['titan', 'heavyweight', 'operator', 'flawed', 'liability']
ALIGNMENTS = ['good', 'bad', 'neutral']


# --------------------------------------------------------------------------- #
# writing
# --------------------------------------------------------------------------- #

def esc(value: str) -> str:
    return (value.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;'))


def col_name(index: int) -> str:
    name = ''
    while index >= 0:
        name = chr(ord('A') + index % 26) + name
        index = index // 26 - 1
    return name


def sheet_xml(rows: list[list[str]], widths: list[int], freeze_header: bool) -> str:
    cols = ''.join(
        f'<col min="{i + 1}" max="{i + 1}" width="{w}" customWidth="1"/>'
        for i, w in enumerate(widths)
    )
    body = []
    for r, row in enumerate(rows, start=1):
        cells = []
        for c, value in enumerate(row):
            if value == '':
                continue
            ref = f'{col_name(c)}{r}'
            style = ' s="1"' if r == 1 else ''
            cells.append(f'<c r="{ref}" t="inlineStr"{style}><is><t xml:space="preserve">{esc(value)}</t></is></c>')
        body.append(f'<row r="{r}">{"".join(cells)}</row>')

    pane = ('<sheetViews><sheetView workbookViewId="0">'
            '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
            '</sheetView></sheetViews>') if freeze_header else ''
    autofilter = f'<autoFilter ref="A1:{col_name(len(widths) - 1)}{len(rows)}"/>' if freeze_header else ''

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'{pane}<cols>{cols}</cols><sheetData>{"".join(body)}</sheetData>{autofilter}</worksheet>'
    )


def write_xlsx(path: Path, sheets: list[tuple[str, list[list[str]], list[int], bool]]) -> None:
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + ''.join(
            f'<Override PartName="/xl/worksheets/sheet{i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            for i in range(len(sheets))
        )
        + '</Types>'
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
        + ''.join(
            f'<sheet name="{esc(name)}" sheetId="{i + 1}" r:id="rId{i + 1}"/>'
            for i, (name, _, _, _) in enumerate(sheets)
        )
        + '</sheets></workbook>'
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + ''.join(
            f'<Relationship Id="rId{i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i + 1}.xml"/>'
            for i in range(len(sheets))
        )
        + f'<Relationship Id="rId{len(sheets) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        '</Relationships>'
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '</Relationships>'
    )
    # One named style: bold, for the header row.
    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
        '<borders count="1"><border/></borders>'
        '<cellStyleXfs count="1"><xf/></cellStyleXfs>'
        '<cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" applyFont="1"/></cellXfs>'
        '</styleSheet>'
    )

    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', content_types)
        z.writestr('_rels/.rels', root_rels)
        z.writestr('xl/workbook.xml', workbook)
        z.writestr('xl/_rels/workbook.xml.rels', workbook_rels)
        z.writestr('xl/styles.xml', styles)
        for i, (_, rows, widths, freeze) in enumerate(sheets):
            z.writestr(f'xl/worksheets/sheet{i + 1}.xml', sheet_xml(rows, widths, freeze))


def do_export() -> None:
    figures = json.loads(JSON_PATH.read_text())
    rows = [[label for _, label, _ in COLUMNS]]
    for fig in figures:
        row = []
        for key, _, _ in COLUMNS:
            value = fig.get(key, '')
            if key in LIST_FIELDS:
                value = ', '.join(value) if value else ''
            elif key == 'reviewed':
                value = 'TRUE' if value else 'FALSE'
            row.append(str(value))
        rows.append(row)

    traits = sorted({t for f in figures for t in f['traits']})
    reference = [['Only these values are accepted. Anything else fails the import.'], []]
    reference += [['category'] + CATEGORIES, ['tier'] + TIERS, ['alignment'] + ALIGNMENTS, []]
    reference += [['traits — use only these, 1 to 4 per figure']]
    reference += [[t] for t in traits]
    reference += [[], ['Notes'],
                  ['bio', 'The whole of what the adjudicator knows about them. Four words minimum, 140 characters max. Say what they specifically did.'],
                  ['rivals', 'Comma-separated ids from the id column. Both directions are not needed; one is enough.'],
                  ['endsRun', 'Leave blank. Exactly one figure in the game may have this, and Nixon has it.'],
                  ['id', 'Do not change. It links portraits, rivalries and saved games.']]

    write_xlsx(XLSX_PATH, [
        ('Roster', rows, [w for _, _, w in COLUMNS], True),
        ('Reference', reference, [42, 20, 20, 20, 20, 20], False),
    ])
    print(f'  wrote {XLSX_PATH.relative_to(ROOT)}  ({len(figures)} figures, {len(COLUMNS)} columns)')


# --------------------------------------------------------------------------- #
# reading
# --------------------------------------------------------------------------- #

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'


def read_sheet(path: Path) -> list[list[str]]:
    """Read the first worksheet, handling both shared and inline strings.

    Excel, Numbers and LibreOffice each save differently; all three use shared
    strings for repeated text, which is why the table has to be resolved rather
    than read straight out of the cells.
    """
    with zipfile.ZipFile(path) as z:
        shared: list[str] = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ElementTree.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root.findall(f'{NS}si'):
                shared.append(''.join(t.text or '' for t in si.iter(f'{NS}t')))

        names = [n for n in z.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+\.xml', n)]
        root = ElementTree.fromstring(z.read(sorted(names)[0]))

        rows: list[list[str]] = []
        for row in root.iter(f'{NS}row'):
            cells: dict[int, str] = {}
            for c in row.findall(f'{NS}c'):
                ref = c.get('r') or ''
                letters = ''.join(ch for ch in ref if ch.isalpha())
                index = 0
                for ch in letters:
                    index = index * 26 + (ord(ch) - ord('A') + 1)
                index -= 1

                kind = c.get('t')
                if kind == 's':
                    v = c.find(f'{NS}v')
                    text = shared[int(v.text)] if v is not None and v.text else ''
                elif kind == 'inlineStr':
                    text = ''.join(t.text or '' for t in c.iter(f'{NS}t'))
                else:
                    v = c.find(f'{NS}v')
                    text = v.text or '' if v is not None else ''
                cells[index] = text.strip()

            width = max(cells) + 1 if cells else 0
            rows.append([cells.get(i, '') for i in range(width)])
        return rows


def do_import() -> None:
    if not XLSX_PATH.exists():
        sys.exit(f'  {XLSX_PATH.relative_to(ROOT)} does not exist - run export first')

    rows = [r for r in read_sheet(XLSX_PATH) if any(cell for cell in r)]
    if not rows:
        sys.exit('  the sheet is empty')

    keys = [key for key, _, _ in COLUMNS]
    errors: list[str] = []
    figures: list[dict] = []

    for n, row in enumerate(rows[1:], start=2):
        row = row + [''] * (len(keys) - len(row))
        raw = dict(zip(keys, row))
        fig: dict = {}
        who = raw['id'] or f'row {n}'

        for key in keys:
            value = raw[key]
            if key in LIST_FIELDS:
                items = [v.strip() for v in value.split(',') if v.strip()]
                if items:
                    fig[key] = items
                elif key not in OPTIONAL:
                    errors.append(f'{who}: {key} is empty')
            elif key == 'reviewed':
                fig[key] = value.strip().upper() in ('TRUE', '1', 'YES')
            elif value:
                fig[key] = value
            elif key not in OPTIONAL:
                errors.append(f'{who}: {key} is empty')

        if fig.get('category') not in CATEGORIES:
            errors.append(f'{who}: category "{fig.get("category")}" is not one of {CATEGORIES}')
        if fig.get('tier') not in TIERS:
            errors.append(f'{who}: tier "{fig.get("tier")}" is not one of {TIERS}')
        if fig.get('alignment') not in ALIGNMENTS:
            errors.append(f'{who}: alignment "{fig.get("alignment")}" is not one of {ALIGNMENTS}')
        if len(fig.get('traits', [])) > 4:
            errors.append(f'{who}: {len(fig["traits"])} traits, the game allows at most 4')
        if len(fig.get('bio', '').split()) < 4:
            errors.append(f'{who}: bio is too thin to judge them on')
        figures.append(fig)

    ids = [f.get('id') for f in figures]
    for dupe in {i for i in ids if ids.count(i) > 1}:
        errors.append(f'duplicate id "{dupe}"')
    known = set(ids)
    for fig in figures:
        for rival in fig.get('rivals', []):
            if rival not in known:
                errors.append(f'{fig.get("id")}: rival "{rival}" is not an id in the sheet')

    enders = [f['id'] for f in figures if f.get('endsRun')]
    if len(enders) > 1:
        errors.append(f'{len(enders)} figures end the run instantly; exactly one is allowed: {enders}')

    if errors:
        print(f'\n  {len(errors)} problem(s) - nothing was written:\n')
        for e in errors[:40]:
            print(f'   - {e}')
        if len(errors) > 40:
            print(f'   ... and {len(errors) - 40} more')
        sys.exit(1)

    JSON_PATH.write_text(json.dumps(figures, indent=2, ensure_ascii=False) + '\n')
    print(f'  wrote {JSON_PATH.relative_to(ROOT)}  ({len(figures)} figures)')
    print('  now run: npm run validate')


if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else ''
    if action == 'export':
        do_export()
    elif action == 'import':
        do_import()
    else:
        sys.exit(__doc__)

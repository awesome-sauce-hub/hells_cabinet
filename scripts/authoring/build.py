"""Turn the authored roster into content/politicians.json.

Stats are written as rough shapes; this rescales each figure to the exact point
budget of its power tier, so an author never has to make six numbers add up by
hand. Shape is preserved, magnitude is normalised.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
exec(open(os.path.join(os.path.dirname(__file__), 'roster.py')).read())

STAT_NAMES = ['charisma','cunning','integrity','grit','intellect','force']
BUDGETS = {'titan':46,'heavyweight':43,'operator':40,'flawed':36,'liability':32}

# Pairs who cannot function in the same cabinet. Drives a penalty and its own
# narration beat, so keep them recognisable rather than exhaustive.
RIVALS = [
    ('churchill','chamberlain'), ('caesar','crassus'), ('batman','joker'),
    ('gandalf','sauron'), ('mario','bowser'), ('mr-burns','homer-simpson'),
    ('stalin','robespierre'), ('mandela','pinochet'), ('allende','pinochet'),
    ('optimus-prime','sauron'), ('gandhi','vlad'), ('lincoln','leopold-ii'),
]

def rescale(raw, budget):
    vals = dict(zip(STAT_NAMES, raw))
    total = sum(vals.values())
    out = {k: min(10, max(1, round(v * budget / total))) for k, v in vals.items()}
    # Correct rounding drift, taking from the largest and giving to the smallest
    # so the figure's shape survives the adjustment.
    guard = 0
    while sum(out.values()) != budget:
        guard += 1
        if guard > 200: raise RuntimeError('cannot balance')
        diff = budget - sum(out.values())
        order = sorted(STAT_NAMES, key=lambda s: -out[s]) if diff > 0 else sorted(STAT_NAMES, key=lambda s: out[s])
        for s in order:
            if diff > 0 and out[s] < 10: out[s] += 1; break
            if diff < 0 and out[s] > 1: out[s] -= 1; break
    return out

by_id = {f['id']: f for f in R}
missing = {i for pair in RIVALS for i in pair} - set(by_id)
if missing: raise SystemExit(f'rivals reference unknown ids: {sorted(missing)}')
for a, b in RIVALS:
    by_id[a].setdefault('rivals', []).append(b)
    by_id[b].setdefault('rivals', []).append(a)

out = []
for f in R:
    entry = {
        'id': f['id'], 'category': f['category'], 'tier': f['tier'],
        'alignment': f['alignment'], 'name': f['name'], 'country': f['country'],
        'era': f['era'], 'office': f['office'], 'bio': f['bio'],
        'stats': rescale(f['stats'], BUDGETS[f['tier']]),
        'traits': f['traits'],
    }
    if f.get('rivals'): entry['rivals'] = sorted(set(f['rivals']))
    if f.get('endsRun'): entry['endsRun'] = f['endsRun']
    entry['reviewed'] = True
    out.append(entry)

path = os.path.join(os.path.dirname(__file__), '..', '..', 'content', 'politicians.json')
with open(path, 'w') as fh:
    json.dump(out, fh, indent=2, ensure_ascii=False); fh.write('\n')
print(f'wrote {len(out)} figures')

#!/usr/bin/env python3
"""Convert identified 2014 GL encounter captures; never infer missing stats."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
encounters = {}
for chapter in [1, 2]:
    raw = json.loads((ROOT/f'docs/sources/tutorial-{chapter}-capture-2014.json').read_text())
    encounters[chapter] = []
    for wave in next(iter(raw.values()))['battles']:
        monsters = []
        for source in wave['monsters']:
            assert source['ai id'] == 1 and source['act counts'] == '1~1'
            action = source['ai']['actions']
            assert len(action) == 1 and action[0]['action']['type'] == 'attack'
            assert action[0]['percent'] == 100 and action[0]['target conditions'] == 'random'
            monsters.append({'id': str(source['unit id']), 'element': source['element'],
                             **source['stats'], 'aiId': source['ai id'], 'actionsPerTurn': 1})
        encounters[chapter].append(monsters)
text = '// Historical GL captures from 2014; provenance: docs/sources/capture-manifest.json.\n'
text += '// These are not verified as the 2022 server encounter values.\n'
text += 'export const TUTORIAL_ENCOUNTERS=' + json.dumps(encounters, separators=(',', ':')) + ';\n'
(ROOT/'dist/tutorial-encounters.js').write_text(text)
print('Prepared 6 historical tutorial encounters')

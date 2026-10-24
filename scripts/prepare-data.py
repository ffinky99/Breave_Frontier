#!/usr/bin/env python3
"""Normalize historical KR datamine entries; retain provenance and raw input."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
raw = json.loads((ROOT/'docs/units-source-kr.json').read_text())
units = []
for d in raw:
    bb = d.get('bb') or {}
    level = (bb.get('levels') or [{}])[0]
    effects = level.get('effects') or []
    effect = effects[0] if effects else {}
    skill_kind = 'attack'
    if d['id'] == 30050: skill_kind = 'attack-buff'
    if d['id'] == 40050: skill_kind = 'defense-buff'
    if not bb: skill_kind = 'none'
    unit = {
        'id': str(d['id']), 'name': d['name'], 'element': d['element'],
        'rarity': d['rarity'], 'cost': d.get('cost',0), 'base': d['stats']['_base'], 'max': d['stats']['_lord'],
        'maxLevel': 20, 'hits': d.get('damage frames',{}).get('hits',1),
        'hitFrames': d.get('damage frames',{}).get('frame times',[]),
        'hitDistribution': d.get('damage frames',{}).get('hit dmg% distribution',[]),
        'dropChecks': d.get('drop check count',1),
        'skill': {'name': bb.get('name','일반 공격'), 'description': bb.get('desc','일반 공격으로 적에게 피해를 줍니다.'),
                  'cost': level.get('bc cost',0), 'bonus': effect.get('bb atk%',0),
                  'hits': (bb.get('damage frames') or [{}])[0].get('hits',1),
                  'hitFrames': (bb.get('damage frames') or [{}])[0].get('frame times',[]),
                  'hitDistribution': (bb.get('damage frames') or [{}])[0].get('hit dmg% distribution',[]),
                  'target': effect.get('target area','single'), 'kind':skill_kind},
        'leader': d.get('leader skill') or {},
        'evolution': d.get('evolution'),
        'source': 'https://github.com/BluuArc/bfmt-data/blob/master/kr/unit/'+str(d['id'])+'.json',
        'sourceUpdatedAt': d.get('bfmtMetadata',{}).get('updatedAt'),
        'hasIllustration': (ROOT/'dist/assets'/('unit_ills_full_'+str(d['id'])+'.png')).exists(),
    }
    units.append(unit)
data={'version':1,'units':units,'starterIds':['10011','20011','30011','40011']}
(ROOT/'dist/units.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print('Normalized',len(units),'units')

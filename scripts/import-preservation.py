#!/usr/bin/env python3
"""Import verified public preservation data without replacing supplied APK assets.

Run after recover-preservation.py. Images remain unmodified. The archive's
Windows GL snapshot is kept distinct from Android APK and historical KR data.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def dump(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('recovery_root', type=Path)
    args = parser.parse_args()
    recovery = args.recovery_root
    apk = json.loads((ROOT/'docs/apk-inventory.json').read_text())
    records = {}
    for name in ['recovered-assets-manifest.json', 'recovered-extra-manifest.json']:
        for entry in json.loads((recovery/name).read_text())['entries']:
            records[entry['path']] = entry
    source = recovery/'preserved-assets'
    for entry in records.values():
        content = (source/entry['path']).read_bytes()
        assert len(content) == entry['bytes']
        assert hashlib.sha256(content).hexdigest() == entry['sha256']
    copied = []
    apk_names = {item['file'] for item in apk['copiedAssets']}
    for uid in apk['unitIds']:
        name = f'unit_ills_full_{uid}.png'
        if name in apk_names:
            continue
        key = 'content/unit/img/' + name
        entry = records[key]
        (ROOT/'dist/assets'/name).write_bytes((source/key).read_bytes())
        copied.append({'file': name, 'sourcePath': key, 'bytes': entry['bytes'], 'sha256': entry['sha256']})
    missing = set(apk['missingResourceReferences'])
    recovered = sorted(missing & {Path(p).name for p in records})
    inventory = {
        'source': 'Project Brave Archive / 21900.zip / assets.zip',
        'url': 'https://drive.google.com/file/d/1ApVcJISPovYuWEidnkkTJi_NI8sD1Xmx/view',
        'snapshot': '2022-04-03 Global Windows client, with historical extras',
        'zipBytes': 14465448570, 'nestedZipOffset': 1479995707, 'nestedZipBytes': 2849846110,
        'archiveFileCount': 76005, 'unitAtlasCount': 2183,
        'matchedMissingReferences': recovered,
        'unresolvedReferences': sorted(missing-set(recovered)),
        'entries': sorted(records.values(), key=lambda e: e['path']),
        'copiedAssets': copied,
    }
    dump(ROOT/'docs/preservation-inventory.json', inventory)
    tutorials = {Path(p).name: (source/p).read_text(encoding='utf-8-sig') for p in records
                 if re.fullmatch(r'content/tuto/tuto\d+\.txt', p)}
    dump(ROOT/'docs/preservation-tutorials.json', tutorials)
    layouts = {Path(p).name: (source/p).read_text(encoding='utf-8-sig') for p in records
               if p.startswith('content/_dlcbundle/layout_') and p.endswith('.csv')}
    dump(ROOT/'docs/preservation-layouts.json', layouts)
    masters = recovery/'preservation-masters'
    unit_masters = sum([json.loads((masters/f'F_UNIT_MST_{i}_Ver1084.json').read_text()) for i in [1,2]], [])
    cgs = json.loads((masters/'F_UNIT_CGS_MST_Ver811.json').read_text())
    missions = json.loads((masters/'F_MISSION_MST_1_Ver1118.json').read_text())
    master_files = json.loads((masters/'manifest.json').read_text())
    if (recovery/'archive-index.json').exists():
        outer = {e['path']: e for e in json.loads((recovery/'archive-index.json').read_text())['entries']}
        master_files = [{**outer[e['path']], **e} for e in master_files]
    subset = {'unit': [u for u in unit_masters if u['unitId'] in apk['unitIds']],
              'animation': [u for u in cgs if u['unitId'] in apk['unitIds']],
              'mission': [u for u in missions if u['missionId'] in ['1','2','10']],
              'originalFiles': master_files}
    dump(ROOT/'docs/preservation-master-subset.json', subset)
    animations = json.loads((ROOT/'dist/animations.json').read_text())
    for unit in subset['animation']:
        uid = unit['unitId']
        mapping = dict(part.split(':', 1) for part in unit['fileByAnimationType'].split('|'))
        animations[uid]['sourceFiles'] = {action: mapping[str(i)] for i,action in enumerate(['idle','move','atk'],1)}
        animations[uid]['reusedActions'] = {'move': 'idle'} if mapping['2'] == mapping['1'] else {}
        # Mandragora's move is explicitly the idle file in the server master.
        if uid == '30050':
            assert mapping['2'] == 'unit_idle_cgs_30050.csv'
            animations[uid]['fallbackActions'] = []
    dump(ROOT/'dist/animations.json', animations)
    if (recovery/'unit-pixel-comparison.json').exists():
        dump(ROOT/'docs/preservation-pixel-comparison.json', json.loads((recovery/'unit-pixel-comparison.json').read_text()))
    print(json.dumps({'verifiedArchiveFiles': len(records), 'recoveredMissing': len(recovered), 'newRuntimeImages': len(copied)}))

if __name__ == '__main__':
    main()

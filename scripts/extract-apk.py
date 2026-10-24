#!/usr/bin/env python3
"""Reproducible extraction of the supplied APK. No Android code is executed."""
import argparse
import collections
import hashlib
import json
import plistlib
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXTRAS = [
    'base.jpg', 'MapVillage_640x809.png', 'MapVillage_640x384.png',
    'dungeon_battle_10100.jpg', 'navi_chara1_0.png', 'navi_chara1_1.png',
    'GachaEndCircleGet_645x644.png', 'GachaGateClose3_500x500.png',
    'attribute_mark.png', 'BattleDungeon10100CloudBack_640x122.png',
    'bf010_map_grass.mp3', 'bf009_village.mp3', 'bf006_btl_boss.mp3',
    'bf201_se_slash1.mp3', 'bf206_se_fire1.mp3', 'bf209_se_water1.mp3',
    'bf212_se_tree1.mp3', 'bf215_se_thunder1.mp3', 'bf221_se_dark1.mp3',
    'bf224_se_cure.mp3', 'bf233_se_skill_action.mp3', 'bf300_se_action.mp3',
    'bf104_zin_quest_clear_ff.mp3', 'bf114_zin_unit_get1.mp3',
    'title2_logo.png', 'header_ui.png', 'character_frame.png',
    'home_character_frame_bg.png', 'footer_btn.png', 'footer_base.png',
    'home_new_btn_menu1.png', 'home_new_btn_box1.png', 'home_new_btn_info1.png',
    'home_new_btn_mission1.png', 'home_new_btn_shortcut1.png', 'home_new_btn_journal1.png',
    'home_win_quest.png', 'home_win_gate.png', 'home_win_arena.png', 'home_win_raid_open.png',
    'battle_ui.png', 'battle_header_ip5.png', 'battle_target_mark.png',
    'battle_footer_base_ip5.png', 'battle_footer_frame_ip5.png',
    'sub_m_btn1.png', 'sub_m_btn2.png', 'sub_s_btn1.png', 'sub_sss_r_btn1.png',
    'sys_win_btn.png', 'sys_win_base.png', 'sys_win_deco_1.png', 'sys_win_deco_2.png',
    'header_title_base.png', 'list_frame0.png', 'list_frame1.png', 'item_frame_0.png',
    'item_thum_20000.png', 'unit_common_plate.png', 'unit_mix_bar_base.png', 'unit_mix_bar_gauge.png',
]

def rows(data):
    return [[float(v) if '.' in v else int(v) for v in line.strip(',\r ').split(',')]
            for line in data.decode('utf-8-sig').splitlines() if line.strip(',\r ')]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('apk', type=Path)
    args = parser.parse_args()
    output = ROOT / 'dist' / 'assets'
    output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.apk) as z:
        names = set(z.namelist())
        ids = sorted(re.match(r'assets/unit_ills_battle_(\d+)\.png$', n).group(1)
                     for n in names if re.fullmatch(r'assets/unit_ills_battle_\d+\.png', n))
        selected = set(EXTRAS)
        animations = {}
        for uid in ids:
            for prefix in ['unit_anime_', 'unit_ills_battle_', 'unit_ills_thum_', 'unit_ills_full_']:
                name = prefix + uid + '.png'
                if 'assets/' + name in names:
                    selected.add(name)
            frames = rows(z.read('assets/unit_cgg_' + uid + '.csv'))
            for frame in frames:
                if len(frame) != 2 + frame[1] * 11:
                    raise ValueError('Invalid CGG length for ' + uid)
            animations[uid] = {'frames': frames, 'actions': {}, 'fallbackActions': []}
            for action in ['idle', 'move', 'atk']:
                source = f'assets/unit_{action}_cgs_{uid}.csv'
                if source not in names:
                    animations[uid]['fallbackActions'].append(action)
                    source = f'assets/unit_idle_cgs_{uid}.csv'
                animation = rows(z.read(source))
                assert all(0 <= r[0] < len(frames) and r[3] >= 0 for r in animation)
                animations[uid]['actions'][action] = animation
        manifest = []
        for name in sorted(selected):
            if 'assets/' + name not in names:
                raise FileNotFoundError(name)
            data = z.read('assets/' + name)
            (output / name).write_bytes(data)
            manifest.append({'file': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        (ROOT / 'dist' / 'animations.json').write_text(json.dumps(animations, separators=(',', ':')))
        ui = {}
        for atlas in ['footer_btn', 'footer_base']:
            data = plistlib.loads(z.read('assets/' + atlas + '.plist'))
            for name, frame in data['frames'].items():
                nums = lambda text: [int(v) for v in re.findall(r'-?\d+', text)]
                ui[name] = {'image': atlas + '.png', 'rect': nums(frame['frame']),
                            'rotated': frame['rotated'], 'sourceRect': nums(frame['sourceColorRect']),
                            'size': nums(frame['sourceSize'])}
        for name, rect in {
            'unit-normal': [0, 0, 320, 116], 'unit-dim': [0, 120, 320, 116],
            'enemy-banner': [0, 239, 640, 116],
            'element-fire': [38, 920, 26, 26], 'element-water': [65, 920, 26, 26],
            'element-earth': [92, 920, 26, 26], 'element-thunder': [119, 920, 26, 26],
            'element-light': [146, 920, 26, 26], 'element-dark': [173, 920, 26, 26],
            'reward-zel': [324, 120, 150, 32], 'reward-karma': [324, 156, 150, 32],
            'reward-unit': [324, 191, 100, 32],
        }.items():
            ui[name] = {'image': 'battle_ui.png', 'rect': rect, 'rotated': False,
                        'sourceRect': [0, 0, *rect[2:]], 'size': rect[2:]}
        (ROOT / 'dist' / 'ui.json').write_text(json.dumps(ui, separators=(',', ':')))
        layouts = {name: z.read('assets/' + name).decode('utf-8-sig') for name in
                   ['layout_header.csv','layout_home2.csv','layout_footer2.csv','layout_battle.csv']}
        (ROOT / 'docs' / 'ui-layout-source.json').write_text(json.dumps(layouts, ensure_ascii=False, indent=2))
        refs = sorted(set(re.findall(r'[A-Za-z0-9_\-]+\.(?:png|jpg|csv|txt|sam)', z.read('assets/resourceMap').decode())))
        missing = [ref for ref in refs if 'assets/' + ref not in names]
        record = {
            'source': args.apk.name, 'sha256': hashlib.sha256(args.apk.read_bytes()).hexdigest(),
            'apkBytes': args.apk.stat().st_size, 'entries': len(names),
            'assetEntries': sum(n.startswith('assets/') for n in names),
            'unitIds': ids, 'playableUnitGraphics': len(ids),
            'allAnimationAtlasesIncludingPlaceholder': sum(bool(re.fullmatch(r'assets/unit_anime_\d+\.png', n)) for n in names),
            'backgrounds': sorted(n for n in names if n.startswith('assets/dungeon_battle_')),
            'tutorials': sorted(n for n in names if re.fullmatch(r'assets/tuto\d+\.txt', n)),
            'resourceMapUniqueReferences': len(refs), 'missingResourceReferences': missing,
            'copiedAssets': manifest,
        }
        (ROOT / 'docs' / 'apk-inventory.json').write_text(json.dumps(record, ensure_ascii=False, indent=2))
    print(json.dumps({'units': len(ids), 'copiedFiles': len(manifest), 'copiedBytes': sum(x['bytes'] for x in manifest), 'missingReferences': len(missing)}))

if __name__ == '__main__':
    main()

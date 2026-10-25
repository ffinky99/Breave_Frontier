#!/usr/bin/env python3
"""Retrieve pinned entries of the public 21900.zip with validated HTTP ranges.

No login, game-server access, or downloaded executable is required. Downloads
are restricted to recorded ZIP entries and verified with CRC32 and SHA-256.
The 14 GB parent archive is not downloaded in full.
"""
import argparse
import concurrent.futures
import hashlib
import json
import struct
import urllib.parse
import urllib.request
import zlib
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_ID = '1ApVcJISPovYuWEidnkkTJi_NI8sD1Xmx'

class DownloadForm(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.fields = {}
        self.action = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'form' and attrs.get('id') == 'download-form':
            self.active = True
            self.action = attrs.get('action')
        if tag == 'input' and self.active and attrs.get('name'):
            self.fields[attrs['name']] = attrs.get('value', '')
    def handle_endtag(self, tag):
        if tag == 'form':
            self.active = False

def direct_url():
    url = 'https://drive.usercontent.google.com/uc?' + urllib.parse.urlencode({'id': ARCHIVE_ID, 'export': 'download'})
    request = urllib.request.Request(url, headers={'Range': 'bytes=0-0', 'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(request, timeout=55) as response:
        if response.status == 206:
            return url
        assert response.headers.get_content_type() == 'text/html', 'Unexpected archive response'
        html = response.read(100_001)
        assert len(html) <= 100_000, 'Unexpected download-form size'
    form = DownloadForm()
    form.feed(html.decode('utf-8'))
    assert form.action == 'https://drive.usercontent.google.com/download', 'Public download form unavailable'
    assert form.fields.get('id') == ARCHIVE_ID and form.fields.get('export') == 'download'
    return form.action + '?' + urllib.parse.urlencode(form.fields)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    parser.add_argument('--workers', type=int, default=4, choices=range(1,7))
    args = parser.parse_args()
    manifest = json.loads((ROOT/'docs/preservation-inventory.json').read_text())
    masters = json.loads((ROOT/'docs/preservation-master-subset.json').read_text())['originalFiles']
    root = args.output.resolve()
    root.mkdir(parents=True, exist_ok=True)
    entries = []
    for raw, base, dest in [(manifest['entries'], manifest['nestedZipOffset'], root/'preserved-assets'),
                            (masters, 0, root/'preservation-masters')]:
        for entry in raw:
            relative = PurePosixPath(entry['path'])
            assert not relative.is_absolute() and '..' not in relative.parts
            target = dest / (entry.get('file') or relative)
            if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == entry['sha256']:
                continue
            entries.append({**entry, 'absoluteOffset': base+entry['offset'], 'target': target})
    groups = []
    for entry in sorted(entries, key=lambda e: e['absoluteOffset']):
        start = entry['absoluteOffset']
        end = start + 30 + len(entry['path'].encode()) + 200 + entry['compressedBytes']
        if groups and start-groups[-1]['end'] < 3_000_000 and end-groups[-1]['start'] < 35_000_000:
            groups[-1]['end'] = end
            groups[-1]['entries'].append(entry)
        else:
            groups.append({'start': start, 'end': end, 'entries': [entry]})
    url = direct_url() if groups else None
    def fetch(group):
        start, end = group['start'], group['end']
        request = urllib.request.Request(url, headers={'Range': f'bytes={start}-{end-1}', 'Accept-Encoding': 'identity'})
        with urllib.request.urlopen(request, timeout=55) as response:
            assert response.status == 206, 'Range download unavailable; full download refused'
            assert response.headers.get('Content-Range') == f"bytes {start}-{end-1}/{manifest['zipBytes']}", 'Archive changed'
            block = response.read(end-start+1)
        assert len(block) == end-start
        return group, block
    count = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(fetch, group) for group in groups]
        for future in concurrent.futures.as_completed(futures):
            group, block = future.result()
            for entry in group['entries']:
                at = entry['absoluteOffset']-group['start']
                header = struct.unpack_from('<4s5H3I2H', block, at)
                assert header[0] == b'PK\x03\x04' and not header[2] & 1, 'Unexpected or encrypted ZIP entry'
                at += 30 + header[-2] + header[-1]
                compressed = block[at:at+entry['compressedBytes']]
                assert entry['compression'] in [0,8]
                data = zlib.decompress(compressed, -15) if entry['compression'] == 8 else compressed
                assert len(data) == entry['bytes']
                assert f'{zlib.crc32(data):08x}' == entry['crc32']
                assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['path']
                entry['target'].parent.mkdir(parents=True, exist_ok=True)
                entry['target'].write_bytes(data)
                count += 1
            print(f'Verified {count}/{len(entries)} files', flush=True)
    (root/'recovered-assets-manifest.json').write_text(json.dumps({'entries': manifest['entries']}))
    (root/'recovered-extra-manifest.json').write_text(json.dumps({'entries': []}))
    (root/'preservation-masters').mkdir(exist_ok=True)
    (root/'preservation-masters/manifest.json').write_text(json.dumps(masters))
    print(f'Recovery complete: {len(manifest["entries"])} assets, {len(masters)} master files')

if __name__ == '__main__':
    main()

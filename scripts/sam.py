"""Read the APK's SuperAnim variant; no native code is executed.

Format reference: Raymond Lu's SuperAnimCore.cpp (MIT; see docs/SuperAnim-LICENSE.txt).
The APK's version-1 canvas bounds use int16 rather than the SDK's int32.
Transforms are retained in the original Flash/canvas, downward-y coordinates.
"""
import copy
import math
import struct


class Reader:
    def __init__(self, data): self.data, self.at = data, 0
    def read(self, fmt):
        size = struct.calcsize('<' + fmt)
        result = struct.unpack_from('<' + fmt, self.data, self.at)
        self.at += size
        return result[0] if len(result) == 1 else list(result)
    def text(self):
        length = self.read('H')
        result = self.data[self.at:self.at+length].decode('utf-8')
        self.at += length
        return result


def decode_sam(data):
    r = Reader(data)
    assert r.read('I') == 0x2e53414d, 'Invalid SAM magic'
    version = r.read('I')
    assert version in (1, 2), 'Unknown SAM version'
    fps = r.read('B')
    bounds = [v / 20 for v in r.read('iiii' if version == 2 else 'hhhh')]
    images = []
    for _ in range(r.read('H')):
        name, w, h = r.text(), r.read('h'), r.read('h')
        a, c, b, d = [v / (65536 * 20) for v in r.read('iiii')]
        x, y = [v / 20 for v in r.read('hh')]
        images.append({'file': name, 'size': [w, h], 'matrix': [a, b, c, d, x, y]})
    frames, objects, labels = [], {}, []
    for frame_no in range(r.read('H')):
        flags = r.read('B')
        assert flags & ~15 == 0, ('Unknown frame flags', flags, frame_no)
        if flags & 1:
            for _ in range(r.read('B')): objects.pop(r.read('H'), None)
        if flags & 2:
            for _ in range(r.read('B')):
                oid, resource = r.read('H') & 0x7ff, r.read('B')
                assert resource < len(images)
                objects[oid] = [oid, resource, [1, 0, 0, 1, 0, 0], [255, 255, 255, 255]]
        if flags & 4:
            for _ in range(r.read('B')):
                move = r.read('H'); oid = move & 0x3ff
                assert oid in objects, ('Missing object', oid, frame_no)
                matrix = [1, 0, 0, 1, 0, 0]
                if move & 0x1000:
                    a, c, b, d = [v / 65536 for v in r.read('iiii')]
                    matrix[:4] = [a, b, c, d]
                elif move & 0x4000:
                    angle = r.read('h') / 1000
                    matrix[:4] = [math.cos(angle), math.sin(angle), -math.sin(angle), math.cos(angle)]
                matrix[4:] = [v / 20 for v in r.read('ii' if move & 0x0800 else 'hh')]
                objects[oid][2] = matrix
                if move & 0x2000: objects[oid][3] = r.read('BBBB')
        if flags & 8: labels.append({'name': r.text(), 'start': frame_no})
        frames.append(copy.deepcopy([objects[k] for k in sorted(objects)]))
    assert r.at == len(data), ('Unconsumed SAM bytes', r.at, len(data))
    for i, label in enumerate(labels): label['end'] = labels[i+1]['start']-1 if i+1 < len(labels) else len(frames)-1
    return {'fps': fps, 'bounds': bounds, 'images': images, 'frames': frames, 'labels': labels}

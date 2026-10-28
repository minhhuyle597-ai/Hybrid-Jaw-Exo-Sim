"""Export a static Atlas from the first saved replay state; no physics rerun.

Requires MuJoCo 3.4.0 and numpy 2.2.6. Set HYBRID_JAW_EXO_SIM_ROOT to v0.1.0.
World coordinates in metres are mapped (x,y,z) -> (y,z,x), a right-handed
rotation: glTF +X = anatomical left, +Y = superior, +Z = anterior.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import xml.etree.ElementTree as ET

import mujoco
import numpy as np
from paths import ROOT, MODEL, MODEL_REL

PROJECT = Path(__file__).resolve().parents[1]
BONES = [
    ('skull', '颅骨', '_skull_vis'),
    ('maxilla', '上颌骨', '_maxilla_vis'),
    ('mandible', '下颌骨', '_mandible_vis'),
    ('hyoid', '舌骨', '_hyoid_vis'),
]
MUSCLES = [
    ('temporalis', '颞肌', ['posterior_temporalis', 'medial_temporalis', 'anterior_temporalis'], '咀嚼肌'),
    ('medial_pterygoid', '翼内肌', ['medial_pterygoid'], '咀嚼肌'),
    ('lateral_pterygoid', '翼外肌', ['superior_lateral_pterygoid', 'inferior_lateral_pterygoid'], '咀嚼肌'),
    ('masseter', '咬肌', ['superficial_masseter', 'deep_masseter'], '咀嚼肌'),
    ('geniohyoid', '颏舌骨肌', ['geniohyoid'], '舌骨上肌群'),
    ('digastric_anterior_belly', '二腹肌前腹', ['anterior_digastric'], '舌骨上肌群'),
    ('mylohyoid', '下颌舌骨肌', ['posterior_mylohyoid', 'anterior_mylohyoid'], '舌骨上肌群'),
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf8')


def write_glb(path, vertices, faces, structure_id):
    """Small dependency-free glTF 2.0 writer; one pickable mesh per bone."""
    normals = np.zeros_like(vertices)
    tris = vertices[faces]
    face_normals = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    for column in range(3):
        np.add.at(normals, faces[:, column], face_normals)
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-20)
    arrays = [vertices.astype('<f4'), normals.astype('<f4'), faces.astype('<u4').ravel()]
    chunks, views, accessors = [], [], []
    offset = 0
    for i, array in enumerate(arrays):
        chunk = array.tobytes()
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(chunk), 'target': 34963 if i == 2 else 34962})
        accessor = {'bufferView': i, 'componentType': 5125 if i == 2 else 5126,
                    'count': len(array), 'type': 'SCALAR' if i == 2 else 'VEC3'}
        if i == 0:
            accessor.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
        accessors.append(accessor)
        chunks.append(chunk)
        offset += len(chunk)
    binary = b''.join(chunks)
    document = {
        'asset': {'version': '2.0', 'generator': 'Hybrid Jaw Replay Lab / export_atlas.py',
                  'copyright': 'Paul-Otto Müller; ArtiSynth / A. G. Hannam. See public/licenses/NOTICE.txt and anatomical-meshes.txt.'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'name': structure_id, 'mesh': 0, 'extras': {'structureId': structure_id}}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1}, 'indices': 2, 'material': 0}]}],
        'materials': [{'pbrMetallicRoughness': {'baseColorFactor': [0.84, 0.79, 0.67, 1], 'metallicFactor': 0, 'roughnessFactor': 0.8}, 'doubleSided': True}],
        'buffers': [{'byteLength': len(binary)}], 'bufferViews': views, 'accessors': accessors,
    }
    doc = json.dumps(document, separators=(',', ':')).encode()
    doc += b' ' * (-len(doc) % 4)
    binary += b'\0' * (-len(binary) % 4)
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(doc) + len(binary))
                     + struct.pack('<II', len(doc), 0x4e4f534a) + doc
                     + struct.pack('<II', len(binary), 0x004e4942) + binary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=PROJECT / 'public/atlas')
    args = parser.parse_args()
    provenance = json.loads((PROJECT / 'public/data/provenance.json').read_text())
    if mujoco.__version__ != provenance['mujoco']:
        raise ValueError('Use the recorded MuJoCo version: ' + provenance['mujoco'])
    commit = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()
    if commit != provenance['release_commit'] or sha(MODEL) != provenance['model_sha256']:
        raise ValueError('Upstream commit or model hash differs from the replay provenance')
    if args.output.exists():
        raise FileExistsError('Use a new --output directory; existing Atlas assets are never overwritten')
    m = mujoco.MjModel.from_xml_path(str(MODEL))
    d = mujoco.MjData(m)
    state_file = PROJECT / 'public/data/states.npz'
    record = np.load(state_file)
    for key in ['qpos', 'qvel', 'act', 'ctrl']:
        getattr(d, key)[:] = record[key][0]
    d.time = float(record['time_s'][0])
    m.actuator_gainprm[24:] = 0
    m.actuator_biasprm[24:] = 0
    mujoco.mj_forward(m, d)
    views = json.loads((PROJECT / 'public/data/views.json').read_text())
    tb = json.loads((PROJECT / 'public/data/textbook.json').read_text())
    first_frame = json.loads((PROJECT / 'public/data/frames.json').read_text())['frames'][0]
    xml = ET.parse(MODEL).getroot()
    mesh_files = {entry.attrib['name']: entry.attrib['file'] for entry in xml.findall('asset/mesh')}
    mesh_root = (MODEL.parent / xml.find('compiler').attrib['meshdir']).resolve()
    args.output.mkdir(parents=True)
    entities, assets, paths = [], [], []
    for name, label, geom_name in BONES:
        geom_id = m.geom(geom_name).id
        mesh_id = m.geom_dataid[geom_id]
        start, count = m.mesh_vertadr[mesh_id], m.mesh_vertnum[mesh_id]
        vertices = m.mesh_vert[start:start + count] @ d.geom_xmat[geom_id].reshape(3, 3).T + d.geom_xpos[geom_id]
        vertices = vertices[:, [1, 2, 0]]
        start, count = m.mesh_faceadr[mesh_id], m.mesh_facenum[mesh_id]
        faces = m.mesh_face[start:start + count]
        sid = 'bone.' + name
        target = args.output / (name + '.glb')
        write_glb(target, vertices, faces, sid)
        source = mesh_root / mesh_files[m.mesh(mesh_id).name]
        assets.append({'id': sid, 'url': 'atlas/' + target.name, 'sha256': sha(target),
                       'source_file': str(source.relative_to(ROOT)), 'source_sha256': sha(source),
                       'geom': geom_name, 'vertices': len(vertices), 'triangles': len(faces)})
        entities.append({'id': sid, 'label': label, 'english': name, 'aliases': [], 'kind': 'bone',
                         'region': '口底' if name == 'hyoid' else '颅颌', 'layer': '骨骼', 'side': 'midline',
                         'representation': 'mesh', 'asset_id': sid, 'bindings': [], 'evidence_groups': [],
                         'note': '上游简化骨骼网格，可能包含未独立分割的结构；未完成逐表面解剖核验。'})
    for name, label, parts, layer in MUSCLES:
        for side, side_label in [('left', '左侧'), ('right', '右侧')]:
            sid = f'muscle.{name}.{side}'
            bindings = []
            for part in parts:
                actuator = next(v for v in views['muscles'] if v['name'] == part + '_' + side)
                i = actuator['id']
                if m.actuator(i).name.lstrip('_') != actuator['name']:
                    raise ValueError('Actuator identity mismatch')
                tid = m.actuator_trnid[i, 0]
                adr, count = int(d.ten_wrapadr[tid]), int(d.ten_wrapnum[tid])
                world = d.wrap_xpos.reshape(-1, 3)[adr:adr + count]
                if len(world) < 2 or not np.isfinite(world).all():
                    raise ValueError('Invalid tendon path')
                if not np.isclose(d.actuator_length[i] * 1000, first_frame['length_mm'][i], atol=1e-5):
                    raise ValueError('First-frame replay mismatch')
                paths.append({'structure_id': sid, 'actuator_name': actuator['name'],
                              'points': np.round(world[:, [1, 2, 0]], 9).tolist(), 'color': actuator['color']})
                bindings.append({k: actuator[k] for k in ['id', 'name', 'code', 'label', 'color']})
            entities.append({'id': sid, 'label': side_label + label, 'english': name.replace('_', ' ') + ' ' + side,
                             'aliases': [label], 'kind': 'muscle', 'region': '口底' if layer == '舌骨上肌群' else '颅颌',
                             'layer': layer, 'side': side, 'representation': 'path', 'asset_id': 'muscle-paths',
                             'bindings': bindings, 'evidence_groups': list(dict.fromkeys(tb['muscles'][b['name']]['group'] for b in bindings)),
                             'note': '以首帧模型肌肉—肌腱路径表示，不是真实肌腹体积或经过独立核验的附着面。'})
    path_file = args.output / 'muscle-paths.json'
    write_json(path_file, {'paths': paths})
    assets.append({'id': 'muscle-paths', 'url': 'atlas/muscle-paths.json', 'sha256': sha(path_file)})
    write_json(args.output / 'manifest.json', {
        'schema_version': 1, 'title': '口颌结构 Atlas', 'units': 'm',
        'coordinates': {'left': '+X', 'superior': '+Y', 'anterior': '+Z', 'from_mujoco': ['y', 'z', 'x']},
        'state': {'frame': 0, 'time_s': float(record['time_s'][0]), 'sha256': sha(state_file)},
        'provenance': {'upstream': provenance['upstream'], 'commit': commit, 'model': MODEL_REL,
                       'model_sha256': sha(MODEL), 'mujoco': mujoco.__version__,
                       'notices': ['licenses/NOTICE.txt', 'licenses/anatomical-meshes.txt']},
        'assets': assets, 'structures': entities,
    })
    print(f'Exported {len(BONES)} bone meshes and {len(paths)} paths for {len(entities)} structures to {args.output}')


if __name__ == '__main__':
    main()

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

const vscode = acquireVsCodeApi();
const status = document.getElementById('status');
const viewport = document.getElementById('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x20242c);
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1e7);
camera.up.set(0, 0, 1);
const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewport.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x606070, 2.5));
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(1, -1, 2); scene.add(light);
const grid = new THREE.GridHelper(100, 10, 0x888888, 0x444444);
grid.rotation.x = Math.PI / 2; grid.position.z = -0.02; scene.add(grid);
const manager = new THREE.LoadingManager();
manager.setURLModifier(() => { throw new Error('Model-referenced resources are disabled in this reviewed build.'); });
const wireframe = document.getElementById('wireframe');
let object;

function resize() {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}
function fit() {
    if (!object) return;
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    if (!Number.isFinite(radius) || radius <= 0) throw new Error('The model has no finite 3D bounds.');
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(22.5)) * 1.4;
    camera.near = Math.max(distance / 10000, 0.0001); camera.far = distance * 100;
    camera.position.copy(center).add(new THREE.Vector3(1, -1, 0.8).normalize().multiplyScalar(distance));
    controls.target.copy(center); camera.updateProjectionMatrix(); controls.update();
    grid.scale.setScalar(Math.max(radius * 3 / 100, 0.001));
}
function validate(bytes, format) {
    if (bytes.length === 0 || bytes.length > 32 * 1024 * 1024) throw new Error('Invalid model size.');
    if (format === 'stl') {
        if (bytes.length >= 84) {
            const count = new DataView(bytes.buffer).getUint32(80, true);
            if (84 + 50 * count === bytes.length) {
                if (!count || count > 500000) throw new Error('STL triangle limit exceeded.');
                return;
            }
        }
        const text = new TextDecoder().decode(bytes);
        if (!/^\s*solid\b/i.test(text) || !/endsolid\b/i.test(text)
            || (text.match(/\bfacet\s+normal\b/gi) || []).length > 500000) {
            throw new Error('Malformed or oversized STL.');
        }
    }
    if (format === 'ply') {
        const head = new TextDecoder().decode(bytes.subarray(0, 65536));
        if (!/^ply\r?\n/.test(head) || !/\bend_header\r?\n/.test(head)) throw new Error('Malformed PLY header.');
        for (const match of head.slice(0, head.indexOf('end_header')).matchAll(/^element\s+\S+\s+(\d+)/gm)) {
            if (Number(match[1]) > 1500000) throw new Error('PLY element limit exceeded.');
        }
    }
}
function load(message) {
    if (!['stl','obj','ply'].includes(message.format) || typeof message.base64 !== 'string'
        || message.base64.length > 44739244) throw new Error('Invalid model message.');
    const bytes = Uint8Array.from(atob(message.base64), c => c.charCodeAt(0));
    validate(bytes, message.format);
    let next;
    if (message.format === 'obj') next = new OBJLoader(manager).parse(new TextDecoder().decode(bytes));
    else {
        const geometry = message.format === 'stl' ? new STLLoader(manager).parse(bytes.buffer) : new PLYLoader(manager).parse(bytes.buffer);
        if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
        next = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color: 0x63b7ed, side: THREE.DoubleSide}));
    }
    let triangles = 0, vertices = 0;
    next.traverse(mesh => {
        if (!mesh.isMesh) return;
        const position = mesh.geometry.getAttribute('position');
        if (!position) throw new Error('Missing model vertices.');
        vertices += position.count;
        triangles += (mesh.geometry.index ? mesh.geometry.index.count : position.count) / 3;
        if (vertices > 1500000 || triangles > 500000) throw new Error('Model geometry limit exceeded.');
        for (let i = 0; i < position.array.length; i++) if (!Number.isFinite(position.array[i])) throw new Error('Non-finite model coordinates.');
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach(m => {m.wireframe = wireframe.checked;});
    });
    if (!triangles || !vertices) throw new Error('No triangles found.');
    if (object) {
        scene.remove(object);
        object.traverse(mesh => { if (mesh.geometry) mesh.geometry.dispose();
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; mats.forEach(m => m?.dispose()); });
    }
    object = next; scene.add(object); fit(); resize(); renderer.render(scene, camera);
    status.textContent = `${message.format.toUpperCase()} · ${triangles} triangles · ${vertices} vertices`;
    vscode.postMessage({type: 'rendered', triangles, vertices});
}
window.addEventListener('message', event => {
    try {
        const m = event.data;
        if (!m || typeof m !== 'object') return;
        if (m.type === 'model') load(m);
        if (m.type === 'error' && typeof m.message === 'string') status.textContent = m.message;
    } catch (error) { status.textContent = `Cannot preview: ${error.message}`; }
});
wireframe.addEventListener('change', () => object?.traverse(mesh => {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; mats.forEach(m => {if (m) m.wireframe = wireframe.checked;});
}));
document.getElementById('fit').addEventListener('click', fit);
window.addEventListener('resize', resize);
resize(); renderer.setAnimationLoop(() => {controls.update(); renderer.render(scene, camera);});
vscode.postMessage({type:'ready'});

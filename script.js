// === NAVIGASI ===
const btnMateri = document.getElementById("btnMateri");
// Mengubah btnCariRumus menjadi dua tombol baru:
const btnQuiz = document.getElementById("btnQuiz"); 
const btnJaringGame = document.getElementById("btnJaringGame"); 

btnMateri.addEventListener("click", () => showSection("materi"));

// Handler untuk Kuis
btnQuiz.addEventListener("click", () => {
    showSection("quiz");
    startQuiz(); 
});

// Handler untuk Tantangan Jaring-Jaring
btnJaringGame.addEventListener("click", () => {
    showSection("jaringGame");
    initializeNetBoard(); // Inisialisasi papan game
});

function showSection(id) {
    document.querySelectorAll("section").forEach(sec => sec.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    
    // Tambahkan logika untuk memperbarui status navigasi
    document.querySelectorAll("nav button").forEach(btn => btn.classList.remove("active-nav"));
    if (id === "materi") document.getElementById("btnMateri").classList.add("active-nav");
    if (id === "jaringGame") document.getElementById("btnJaringGame").classList.add("active-nav");
    if (id === "quiz") document.getElementById("btnQuiz").classList.add("active-nav");
}

// === VARIABEL GLOBAL 3D (Logika Awal Dipertahankan) ===
let scene, camera, renderer;
let container = document.getElementById("scene-container");
let controlsDrag = { dragging: false, prevX: 0, prevY: 0 };
let currentShapeName = null;
let faceGroup = null; 
let assembled = true; 
let animationFrameId = null;

// === VARIABEL GLOBAL PERMAINAN JARING-JARING ===
const netBoard = document.getElementById("net-board");
const btnLipat = document.getElementById("btnLipat");
const btnReset = document.getElementById("btnReset");
const gameMessage = document.getElementById("game-message");
const activeShapeNameDisplay = document.getElementById("activeShapeName");

let activeShapeType = 'Persegi'; // Default: Persegi
const BOARD_SIZE_GAME = 5; // Papan 5x5
let netBoardState = []; 
// Titik pusat
const CENTER_ROW = Math.floor(BOARD_SIZE_GAME / 2);
const CENTER_COL = Math.floor(BOARD_SIZE_GAME / 2);

// util warna untuk tiap muka (ditingkatkan estetik)
const FACE_COLORS = [
    0x4CAF50, // Hijau Cerah
    0x2196F3, // Biru Cerah
    0xFF9800, // Oranye
    0x9C27B0, // Ungu
    0xF44336, // Merah
    0x00BCD4  // Cyan
];

// === INISIALISASI SCENE (Logika Awal Dipertahankan) ===
function initScene() {
    // clear previous
    if (renderer) {
        cancelAnimationFrame(animationFrameId);
        renderer.dispose();
        container.innerHTML = "";
        scene = null;
        camera = null;
        renderer = null;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0); 
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 600;
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(2, 2, 4); 
    camera.lookAt(0, 0, 0); 

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    container.classList.remove('hidden');

    // lights 
    const ambientLight = new THREE.AmbientLight(0xaaaaaa, 0.7); 
    scene.add(ambientLight);
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight1.position.set(5, 5, 5);
    scene.add(directionalLight1);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-5, -5, -5);
    scene.add(directionalLight2);
    
    // Tambahkan grid/lantai sederhana
    const gridHelper = new THREE.GridHelper(10, 10, 0xcccccc, 0xeeeeee);
    gridHelper.position.y = -1.5;
    gridHelper.material.opacity = 0.5;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);


    // simple drag-rotate
    renderer.domElement.addEventListener('mousedown', (e) => {
        controlsDrag.dragging = true;
        controlsDrag.prevX = e.clientX;
        controlsDrag.prevY = e.clientY;
        if (faceGroup) faceGroup.userData.autoRotate = false; 
    });
    window.addEventListener('mouseup', () => {
        controlsDrag.dragging = false;
        if (faceGroup) faceGroup.userData.autoRotate = true; 
    });
    renderer.domElement.addEventListener('mousemove', (e) => {
        if (!controlsDrag.dragging) return;
        const dx = e.clientX - controlsDrag.prevX;
        const dy = e.clientY - controlsDrag.prevY;
        scene.rotation.y += dx * 0.01;
        scene.rotation.x += dy * 0.01;
        controlsDrag.prevX = e.clientX;
        controlsDrag.prevY = e.clientY;
    });

    // responsive
    window.addEventListener('resize', () => {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || 600;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    });
}

// === BANGUN RUANG: BANGUNAN DARI MUKA (Logika Awal Dipertahankan) ===
function createFace(width, height, colorIndex) {
    const mat = new THREE.MeshStandardMaterial({ 
        color: FACE_COLORS[colorIndex % FACE_COLORS.length], 
        side: THREE.DoubleSide, 
        transparent: true,
        opacity: 0.95 
    });
    const geom = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geom, mat);

    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 }));
    mesh.add(line); 

    return mesh;
}

// Fungsi untuk membuat sisi Segitiga (alas dan tutup Prisma)
function createTriangleFace(p1, p2, p3, colorIndex) {
    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        p1.x, p1.y, p1.z,
        p2.x, p2.y, p2.z,
        p3.x, p3.y, p3.z
    ]);
    
    // Hitung normal manual untuk pencahayaan yang benar
    const vA = new THREE.Vector3().subVectors(p2, p1);
    const vB = new THREE.Vector3().subVectors(p3, p1);
    const normal = new THREE.Vector3().crossVectors(vA, vB).normalize();

    const normals = new Float32Array([
        normal.x, normal.y, normal.z,
        normal.x, normal.y, normal.z,
        normal.x, normal.y, normal.z,
    ]);

    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geom.setIndex([0, 1, 2]);

    const mat = new THREE.MeshStandardMaterial({
        color: FACE_COLORS[colorIndex % FACE_COLORS.length],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95
    });
    const mesh = new THREE.Mesh(geom, mat);
    
    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 }));
    mesh.add(line); 

    return mesh;
}


function buildCubeFaces(size = 1.6) {
    const g = new THREE.Group();
    const half = size / 2;

    function makeFace(colorIndex) {
        return createFace(size, size, colorIndex);
    }

    const faces = {};
    faces.front = makeFace(0); faces.front.position.set(0, 0, half);
    faces.back = makeFace(1); faces.back.position.set(0, 0, -half); faces.back.rotateY(Math.PI);
    faces.right = makeFace(2); faces.right.position.set(half, 0, 0); faces.right.rotateY(-Math.PI / 2);
    faces.left = makeFace(3); faces.left.position.set(-half, 0, 0); faces.left.rotateY(Math.PI / 2);
    faces.top = makeFace(4); faces.top.position.set(0, half, 0); faces.top.rotateX(-Math.PI / 2);
    faces.bottom = makeFace(5); faces.bottom.position.set(0, -half, 0); faces.bottom.rotateX(Math.PI / 2);

    Object.values(faces).forEach(f => g.add(f));
    return { group: g, faces };
}

function buildBalokFaces(w=2.2, h=1.2, d=1.0) {
    const group = new THREE.Group();
    const hx = w/2, hy = h/2, hz = d/2;

    function facePlane(wi, hi, colorIndex) {
        return createFace(wi, hi, colorIndex);
    }

    const faces = {};
    faces.front  = facePlane(w, h, 0); faces.front.position.set(0, 0, hz);
    faces.back   = facePlane(w, h, 1); faces.back.position.set(0, 0, -hz); faces.back.rotateY(Math.PI);
    faces.right  = facePlane(d, h, 2); faces.right.position.set(hx, 0, 0); faces.right.rotateY(-Math.PI/2);
    faces.left   = facePlane(d, h, 3); faces.left.position.set(-hx, 0, 0); faces.left.rotateY(Math.PI/2);
    faces.top    = facePlane(w, d, 4); faces.top.position.set(0, hy, 0); faces.top.rotateX(-Math.PI/2);
    faces.bottom = facePlane(w, d, 5); faces.bottom.position.set(0, -hy, 0); faces.bottom.rotateX(Math.PI/2);

    faces.front.userData.name = 'front';
    faces.back.userData.name = 'back';
    faces.right.userData.name = 'right';
    faces.left.userData.name = 'left';
    faces.top.userData.name = 'top';
    faces.bottom.userData.name = 'bottom';


    Object.values(faces).forEach(f => group.add(f));
    return { group, faces, dims: { w, h, d } };
}

// Fungsi sederhana yang lebih stabil untuk visualisasi Prisma Segitiga
// Ditambahkan parameter untuk kontrol ukuran
function createPrismaMesh(baseScale = 1.0, height = 2.0) {
    const shape = new THREE.Shape();
    
    // Faktor skala baru (misalnya 0.6) diaplikasikan ke koordinat alas
    const scaleFactor = baseScale * 0.6; 
    
    // Segitiga Alas dengan ukuran yang dikecilkan
    shape.moveTo(-1 * scaleFactor, -1 * scaleFactor);
    shape.lineTo(1.5 * scaleFactor, 0 * scaleFactor); 
    shape.lineTo(-0.5 * scaleFactor, 1.5 * scaleFactor); 
    shape.closePath();
    
    const geo = new THREE.ExtrudeGeometry(shape, { 
        depth: height, // Tinggi Prisma 
        bevelEnabled: false 
    });
    // Posisikan agar terpusat
    geo.translate(0, 0, -height / 2);
    
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xf7a041, // Warna Prisma
        transparent: true,
        opacity: 0.95 
    });
    
    const mesh = new THREE.Mesh(geo, material);
    
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 }));
    mesh.add(line); 
    
    return mesh; // Mengembalikan mesh tunggal
}


// === ANIMATOR (Logika Awal Dipertahankan) ===
function animateFacesToTargets(facesArray, targets, duration = 1200, onComplete = null) {
    const start = performance.now();
    const starts = facesArray.map(f => ({
        pos: f.position.clone(),
        quat: f.quaternion.clone()
    }));

    function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // Ease in/out cubik

        facesArray.forEach((f, i) => {
            const s = starts[i];
            const tgt = targets[i];

            f.position.lerpVectors(s.pos, tgt.pos, ease);
            THREE.Quaternion.slerp(s.quat, tgt.quat, f.quaternion, ease);
        });

        renderer.render(scene, camera);

        if (t < 1) {
            animationFrameId = requestAnimationFrame(step);
        } else {
            if (faceGroup) faceGroup.userData.autoRotate = true; 
            animationFrameId = requestAnimationFrame(function loop() { renderer.render(scene, camera); animationFrameId = requestAnimationFrame(loop); });
            if (onComplete) onComplete();
        }
    }

    if (faceGroup) faceGroup.userData.autoRotate = false; 
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(step);
}


function animateRotate() {
    if (faceGroup && faceGroup.userData.autoRotate) {
        faceGroup.rotation.y += 0.005; 
        faceGroup.rotation.x += 0.001; 
    }
    if (renderer) renderer.render(scene, camera);
    animationFrameId = requestAnimationFrame(animateRotate);
}


// === MAKE AND SHOW SHAPE (Logika Awal Dipertahankan) ===
function showShape(shapeName) {
    initScene();
    currentShapeName = shapeName;
    assembled = true;
    faceGroup = null;

    if (shapeName === "Kubus") {
        const { group, faces } = buildCubeFaces(1.6);
        faceGroup = group;
        faceGroup.userData.autoRotate = true; 
        faceGroup.userData.facesMap = faces; 
        scene.add(faceGroup);

    } else if (shapeName === "Balok") {
        const { group, faces, dims } = buildBalokFaces(2.2, 1.2, 1.0);
        faceGroup = group;
        faceGroup.userData.dims = dims; 
        faceGroup.userData.facesMap = faces; 
        faceGroup.userData.autoRotate = true;
        scene.add(faceGroup);
        
    } else if (shapeName === "Prisma") {
        // Panggil fungsi dengan skala alas 0.8 dan tinggi 2
        const mesh = createPrismaMesh(0.8, 2); 
        
        faceGroup = mesh; 
        faceGroup.userData.autoRotate = true;
        faceGroup.userData.isMesh = true; // Flag untuk toNet
        scene.add(faceGroup);
        
    } else { // Limas
        // Limas
        let material = new THREE.MeshStandardMaterial({ 
            color: 0x0dd1ec, // Warna Limas
            transparent: true,
            opacity: 0.95
        });
        const geo = new THREE.ConeGeometry(1.2, 1.8, 4); // Limas Segiempat
        let mesh = new THREE.Mesh(geo, material);
        
        const edges = new THREE.EdgesGeometry(mesh.geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 }));
        mesh.add(line); 

        faceGroup = mesh; 
        faceGroup.userData.autoRotate = true;
        faceGroup.userData.isMesh = true; // Flag untuk toNet
        scene.add(faceGroup);
    }
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animateRotate(); 
}

// === TRANSISI KE JARING-JARING (PERBAIKAN FOKUS ADA DI SINI) ===
function toNet() {
    if (!currentShapeName) { alert("Pilih bangun ruang terlebih dahulu!"); return; }
    
    // Periksa apakah objek adalah mesh tunggal (Prisma/Limas)
    if (faceGroup && faceGroup.userData.isMesh) { 
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (faceGroup) faceGroup.userData.autoRotate = false;
        
        showNetImage2D(currentShapeName);
        assembled = false;
        return;
    }

    if (!faceGroup || !faceGroup.userData.facesMap) { alert("Tidak ada data wajah untuk bentuk ini."); return; }
    
    const facesMap = faceGroup.userData.facesMap;
    const targets = [];
    const facesArray = [];
    
    // Target Rotation (Datar pada bidang XY)
    const flatQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));


    if (currentShapeName === "Kubus") {
        const s = 1.6; // side size
        
        facesArray.push(facesMap.front);
        targets.push({ pos: new THREE.Vector3(0, 0, 0), quat: flatQuat });
        
        facesArray.push(facesMap.right);
        targets.push({ pos: new THREE.Vector3(s, 0, 0), quat: flatQuat });
        
        facesArray.push(facesMap.left);
        targets.push({ pos: new THREE.Vector3(-s, 0, 0), quat: flatQuat });
        
        facesArray.push(facesMap.top);
        targets.push({ pos: new THREE.Vector3(0, s, 0), quat: flatQuat });
        
        facesArray.push(facesMap.bottom);
        targets.push({ pos: new THREE.Vector3(0, -s, 0), quat: flatQuat });
        
        facesArray.push(facesMap.back);
        targets.push({ pos: new THREE.Vector3(0, s * 2, 0), quat: flatQuat });

    } else if (currentShapeName === "Balok") {
        const dims = faceGroup.userData.dims; 
        const w = dims.w; // Lebar (X)
        const h = dims.h; // Tinggi (Y)
        const d = dims.d; // Kedalaman (Z)
            
        facesArray.push(
            facesMap.front,   // 0: w x h (Muka utama)
            facesMap.top,     // 1: w x d (Atas)
            facesMap.bottom,  // 2: w x d (Bawah)
            facesMap.back,    // 3: w x h (Belakang)
            facesMap.left,    // 4: d x h (Kiri)
            facesMap.right    // 5: d x h (Kanan)
        );
        
        // 0. Front (w x h) - Pusat Jaring-Jaring
        targets.push({ pos: new THREE.Vector3(0, 0, 0), quat: flatQuat });
        
        // --- Susunan Vertikal (Disambungkan ke Front) ---
        
        // 1. Top (w x d) - Di atas Front. Posisi Y: (Front H/2) + (Top D/2)
        const posY_top = h / 2 + d / 2;
        targets.push({ pos: new THREE.Vector3(0, posY_top, 0), quat: flatQuat });
        
        // 2. Bottom (w x d) - Di bawah Front. Posisi Y: -(Front H/2) - (Bottom D/2)
        const posY_bottom = -(h / 2 + d / 2);
        targets.push({ pos: new THREE.Vector3(0, posY_bottom, 0), quat: flatQuat });
        
        // 3. Back (w x h) - Di atas Top. Posisi Y: (Top Pos Y + Top D/2) + (Back H/2)
        const posY_back = posY_top + d / 2 + h / 2;
        targets.push({ pos: new THREE.Vector3(0, posY_back, 0), quat: flatQuat });
        
        // --- Susunan Horizontal (Disambungkan ke Front) ---
        
        // 4. Left (d x h) - Di kiri Front. Posisi X: -(Front W/2) - (Left D/2)
        const posX_left = -(w / 2 + d / 2);
        targets.push({ pos: new THREE.Vector3(posX_left, 0, 0), quat: flatQuat });
        
        // 5. Right (d x h) - Di kanan Front. Posisi X: (Front W/2) + (Right D/2)
        const posX_right = w / 2 + d / 2;
        targets.push({ pos: new THREE.Vector3(posX_right, 0, 0), quat: flatQuat });

        // Offset keseluruhan net vertikal agar terpusat
        const minY = targets.reduce((min, t) => Math.min(min, t.pos.y), 0);
        const maxY = targets.reduce((max, t) => Math.max(max, t.pos.y), 0);
        const centerOffset = - (minY + maxY) / 2; 
        targets.forEach(t => t.pos.y += centerOffset);
    }
    
    animateFacesToTargets(facesArray, targets, 1000, () => { assembled = false; });
}

// === KEMBALIKAN KE BENTUK TERPASANG (Logika Awal Dipertahankan) ===
function toAssembled() {
    if (!currentShapeName) return;
    
    // Jika sedang menampilkan 2D image (Prisma/Limas), kembali ke 3D mesh (reload)
    if (!assembled && faceGroup && faceGroup.userData.isMesh) {
         document.getElementById("scene-container").classList.add("hidden"); 
         showShape(currentShapeName); 
         return;
    }
    
    if (!faceGroup) return;

    // Untuk Kubus dan Balok, kita reload agar kembali ke posisi awal
    showShape(currentShapeName);
    assembled = true;
}


// === NET IMAGE 2D FOR PRISMA & LIMAS (Logika Awal Dipertahankan) ===
function showNetImage2D(shapeName) {
    // Sembunyikan objek 3D
    if (faceGroup) scene.remove(faceGroup);
    
    container.innerHTML = "";
    const wrapper = document.createElement('div');
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "center";
    wrapper.style.flexDirection = "column";
    wrapper.style.background = "#fff";

    const img = document.createElement('img');
    img.style.maxWidth = "80%";
    img.style.maxHeight = "80%";
    img.style.opacity = "0";
    img.style.transition = "opacity 600ms ease";

    // Ganti ini dengan path file lokal Anda jika sudah diunduh
    if (shapeName === "Prisma") {
        img.src = "assets/prisma-segitiga.png"; // Asumsi Anda punya gambar jaring-jaring prisma
    } else if (shapeName === "Limas") {
        img.src = "assets/limas.jpg"; // Asumsi Anda punya gambar jaring-jaring limas
    } else {
        img.src = "";
    }

    const caption = document.createElement('div');
    caption.textContent = "Jaring-jaring: " + shapeName;
    caption.style.marginTop = "10px";
    caption.style.fontWeight = "600";

    wrapper.appendChild(img);
    wrapper.appendChild(caption);
    container.appendChild(wrapper);

    setTimeout(() => { img.style.opacity = "1"; }, 40);
}

// === PILIH BANGUN RUANG (handler tombol Materi) ===
document.querySelectorAll(".shape-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        const shape = e.target.dataset.shape || e.target.innerText || null;
        if (!shape) return;
        document.getElementById("scene-container").classList.remove("hidden");
        document.getElementById("action-buttons").classList.remove("hidden");
        
        document.querySelectorAll(".shape-btn").forEach(b => b.classList.remove("selected"));
        e.target.classList.add("selected");
        
        showShape(shape);
    });
});

// === HANDLE tombol "Lihat Jaring-Jaring" ===
const btnJaring = document.getElementById("btnJaring");
btnJaring.addEventListener("click", () => {
    if (!currentShapeName) { alert("Pilih bangun ruang dulu!"); return; }
    if (assembled) {
        toNet();
        btnJaring.textContent = "🔺 Kembali ke Bentuk 3D"; 
    } else {
        toAssembled();
        btnJaring.textContent = "🔄 Lihat Jaring-Jaring"; 
    }
});


// ==========================================================
// *** LOGIKA TANTANGAN JARING-JARING BANGUN RUANG (Diperbaiki untuk sistem Titik Pusat) ***
// ==========================================================

// 1. Pilih Alat (Bentuk 2D)
document.querySelectorAll(".palette-shape-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        const type = e.target.dataset.shapeType;
        if (!type) return;

        activeShapeType = type;
        activeShapeNameDisplay.textContent = type;

        document.querySelectorAll(".palette-shape-btn").forEach(b => b.classList.remove("selected-tool"));
        e.target.classList.add("selected-tool");

        gameMessage.textContent = `Alat aktif diubah menjadi ${type}.`;
        updateBoardVisuals(); // Panggil fungsi visual yang benar
    });
});

// Helper: Mendapatkan tetangga (r, c)
function getNeighbors(r, c) {
    const neighbors = [];
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < BOARD_SIZE_GAME && nc >= 0 && nc < BOARD_SIZE_GAME) {
            neighbors.push([nr, nc]);
        }
    }
    return neighbors;
}

// Helper: Cek Keterhubungan
function isConnected(state) {
    const faces = [];
    for (let i = 0; i < BOARD_SIZE_GAME; i++) {
        for (let j = 0; j < BOARD_SIZE_GAME; j++) {
            if (state[i][j] !== null) {
                faces.push([i, j]);
            }
        }
    }
    if (faces.length === 0) return { connected: true, faces };

    const visited = new Set();
    const stack = [faces[0]]; 

    while (stack.length > 0) {
        const [r, c] = stack.pop();
        const key = `${r},${c}`;
        if (visited.has(key)) continue;
        visited.add(key);

        getNeighbors(r, c).forEach(([nr, nc]) => {
            if (state[nr][nc] !== null) {
                if (!visited.has(`${nr},${nc}`)) {
                    stack.push([nr, nc]);
                }
            }
        });
    }

    return { connected: visited.size === faces.length, faces };
}


// 2. Inisialisasi Papan dengan Titik Pusat (Diperbaiki dari logika toggle Tile sederhana)
function initializeNetBoard() {
    netBoard.innerHTML = '';
    gameMessage.textContent = 'Klik Titik Utama (kotak kuning) untuk memulai menyusun jaring-jaring!';
    gameMessage.style.color = '#333';
    netBoardState = [];
    
    // Inisialisasi state array
    for (let i = 0; i < BOARD_SIZE_GAME; i++) {
        netBoardState[i] = Array(BOARD_SIZE_GAME).fill(null);
    }

    // Pastikan default tool terseleksi
    document.querySelectorAll('.palette-shape-btn').forEach(b => b.classList.remove("selected-tool"));
    const defaultTool = document.querySelector('.palette-shape-btn[data-shape-type="Persegi"]');
    if (defaultTool) {
        defaultTool.classList.add("selected-tool");
        activeShapeType = 'Persegi';
        activeShapeNameDisplay.textContent = 'Persegi';
    }
    
    // Bangun papan
    for (let i = 0; i < BOARD_SIZE_GAME; i++) {
        for (let j = 0; j < BOARD_SIZE_GAME; j++) {
            const tile = document.createElement('div');
            tile.classList.add('net-tile');
            tile.dataset.row = i;
            tile.dataset.col = j;
            tile.addEventListener('click', handleTileClick);
            
            const faceShape = document.createElement('div');
            faceShape.classList.add('face-shape');
            tile.appendChild(faceShape);
            
            if (i === CENTER_ROW && j === CENTER_COL) {
                tile.classList.add('center-tile');
            }
            netBoard.appendChild(tile);
        }
    }
    document.getElementById('result-modal').style.display='none';
    updateBoardVisuals();
}


// Helper: Memperbarui tampilan papan (dipanggil setiap ada perubahan state)
function updateBoardVisuals() {
    const { faces } = isConnected(netBoardState); 
    const hasPlacedShape = faces.length > 0;
    
    document.querySelectorAll('.net-tile').forEach(tile => {
        const row = parseInt(tile.dataset.row);
        const col = parseInt(tile.dataset.col);
        const type = netBoardState[row][col];
        
        tile.removeAttribute('data-type');
        tile.classList.remove('has-shape'); 

        if (type) {
            tile.classList.add('has-shape');
            tile.dataset.type = type; 
        }

        // Atur kursor (berfungsi sebagai indikator yang bisa diklik)
        if (type) {
            tile.style.cursor = 'default';
        } else if (!hasPlacedShape && row === CENTER_ROW && col === CENTER_COL) {
            tile.style.cursor = 'pointer';
        } else if (hasPlacedShape) {
            const isNeighborToExisting = getNeighbors(row, col).some(([nr, nc]) => netBoardState[nr][nc] !== null);
            tile.style.cursor = isNeighborToExisting ? 'crosshair' : 'not-allowed';
        } else {
             tile.style.cursor = 'not-allowed';
        }
    });

    if (hasPlacedShape) {
        gameMessage.textContent = `Anda telah menyusun ${faces.length} muka. Sambungkan ubin baru ke sisi yang tersedia.`;
    }
}

// 3. Handle Klik Ubin (Pengganti toggleTile)
function handleTileClick(e) {
    const tile = e.currentTarget;
    const row = parseInt(tile.dataset.row);
    const col = parseInt(tile.dataset.col);
    
    // Jika ubin sudah terisi, hapus (fungsi toggle)
    if (netBoardState[row][col] !== null) {
        netBoardState[row][col] = null;
        updateBoardVisuals();
        return;
    }
    
    const { faces } = isConnected(netBoardState);

    let isValidPlacement = false;
    
    if (faces.length === 0 && (row === CENTER_ROW && col === CENTER_COL)) {
        // Kasus 1: Titik utama pertama kali diklik
        isValidPlacement = true;
    } else if (faces.length > 0) {
        // Kasus 2: Sambung ke ubin yang sudah ada
        const isNeighborToExisting = getNeighbors(row, col).some(([nr, nc]) => netBoardState[nr][nc] !== null);
        if (isNeighborToExisting) {
            isValidPlacement = true;
        }
    }

    if (isValidPlacement) {
        netBoardState[row][col] = activeShapeType;
    } else {
        alert("Pemasangan harus dimulai dari Titik Utama (kuning) atau disambung ke sisi ubin yang sudah ada!");
        return;
    }

    updateBoardVisuals();
    gameMessage.textContent = '';
}


// Fungsi utama untuk memeriksa Jaring-Jaring (Umpan Balik dengan Pop-up)
function checkNetValidity() {
    const { connected, faces } = isConnected(netBoardState);
    const counts = {
        'Persegi': faces.filter(([r, c]) => netBoardState[r][c] === 'Persegi').length,
        'PersegiPanjang': faces.filter(([r, c]) => netBoardState[r][c] === 'PersegiPanjang').length,
        'Segitiga': faces.filter(([r, c]) => netBoardState[r][c] === 'Segitiga').length,
        'Total': faces.length
    };
    
    const modal = document.getElementById('result-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    // Cek Dasar
    if (faces.length === 0 || !connected) {
        modalTitle.textContent = "❌ Susunan Gagal Dikenali!";
        modalTitle.classList.remove('success'); modalTitle.classList.add('error');
        if (faces.length === 0) {
            modalBody.textContent = "Anda belum menyusun jaring-jaring.";
        } else {
            modalBody.textContent = `Bentuk-bentuk yang Anda susun (${counts.Total} muka) tidak saling terhubung, sehingga tidak bisa dilipat.`;
        }
        modal.style.display = 'block';
        return;
    }
    
    // Cek Tumpang Tindih (Heuristik)
    let isOverlapping = false;
    for (let i = 0; i < BOARD_SIZE_GAME; i++) {
        if (netBoardState[i].filter(s => s !== null).length > 4) { isOverlapping = true; break; }
    }
    if (!isOverlapping) {
        for (let j = 0; j < BOARD_SIZE_GAME; j++) {
            let count = 0;
            for (let i = 0; i < BOARD_SIZE_GAME; i++) {
                if (netBoardState[i][j] !== null) count++;
            }
            if (count > 4) { isOverlapping = true; break; }
        }
    }
    
    if (isOverlapping) {
        modalTitle.textContent = "⚠️ Jaring-Jaring Tidak Valid (Tumpang Tindih)!";
        modalTitle.classList.remove('success'); modalTitle.classList.add('error');
        modalBody.textContent = "Susunan ini memiliki 5 atau lebih ubin dalam satu baris/kolom lurus. Pola ini akan tumpang tindih saat dilipat. Coba buat yang lebih kompak!";
        modal.style.display = 'block';
        return;
    }


    // --- Logika Deteksi Bangun Ruang ---
    let title = "⭐ Jaring-Jaring Anda Terhubung!";
    let body = `Anda menyusun ${counts.Total} muka. `;
    let isSuccess = false;

    // Kubus (6 muka Persegi)
    if (counts.Total === 6 && counts.Persegi === 6 && counts.PersegiPanjang === 0 && counts.Segitiga === 0) {
         title = "🎉 Bangun Ruang Terbentuk: KUBUS!";
         body = "6 Muka Persegi ini adalah salah satu jaring-jaring **Kubus** yang valid. Kerja bagus!";
         isSuccess = true;
    } 
    // Balok (6 muka, minimal ada Persegi Panjang atau Persegi dengan ukuran berbeda)
    else if (counts.Total === 6 && counts.Segitiga === 0) {
        title = "✨ Bangun Ruang Terbentuk: BALOK!";
        body = "6 Muka (Persegi dan/atau Persegi Panjang) ini adalah salah satu jaring-jaring **Balok** yang valid.";
        isSuccess = true;
    } 
    // Prisma Segitiga (5 muka: 2 Segitiga, 3 Persegi/Persegi Panjang)
    else if (counts.Total === 5 && counts.Segitiga === 2 && (counts.Persegi + counts.PersegiPanjang) === 3) {
        title = "💡 Bangun Ruang Terbentuk: PRISMA SEGITIGA!";
        body = "2 Alas Segitiga dan 3 Sisi Tegak (Persegi/Persegi Panjang) ini adalah jaring-jaring **Prisma Segitiga**.";
        isSuccess = true;
    } 
    // Limas Segiempat (5 muka: 4 Segitiga, 1 Alas)
    else if (counts.Total === 5 && counts.Segitiga === 4 && (counts.Persegi + counts.PersegiPanjang) === 1) {
        title = "🧐 Bangun Ruang Terbentuk: LIMAS SEGIEMPAT!";
        body = "4 Sisi Tegak Segitiga dan 1 Alas (Persegi/Persegi Panjang) ini adalah jaring-jaring **Limas Segiempat**.";
        isSuccess = true;
    }
    
    // Pesan Eksplorasi
    if (!isSuccess) {
        title = "⭐ Jaring-Jaring Terhubung, Eksplorasi Hebat!";
        modalTitle.classList.remove('error'); modalTitle.classList.add('success');
        body = `Susunan Anda terhubung dengan ${counts.Total} muka. Lanjutkan eksplorasi Anda untuk menemukan bangun ruang lainnya!`;
    }

    // Tampilkan Modal
    modalTitle.textContent = title;
    modalBody.textContent = body;
    modalTitle.className = isSuccess ? 'success' : 'error';
    modal.style.display = 'block';
}


btnLipat.addEventListener('click', checkNetValidity);
btnReset.addEventListener('click', initializeNetBoard);

// Tambahkan handler untuk tombol tutup modal
document.querySelector('#result-modal .close-btn').addEventListener('click', () => {
    document.getElementById('result-modal').style.display='none';
});
// Tambahkan handler untuk tombol tutup modal di dalam modal body
document.querySelector('#result-modal .modal-content').addEventListener('click', (e) => {
    if(e.target.tagName === 'BUTTON' && e.target.textContent === 'Tutup') {
        document.getElementById('result-modal').style.display='none';
    }
});


// ==========================================================
// *** LOGIKA KUIS UJI PEMAHAMAN ***
// ==========================================================

const quizData = [
    {
        question: "Berapakah jumlah rusuk pada bangun ruang Kubus?",
        answers: ["12", "8", "6", "9"],
        correct: "12"
    },
    {
        question: "Prisma Segitiga memiliki alas dan tutup berbentuk apa?",
        answers: ["Persegi", "Segitiga", "Persegi Panjang", "Lingkaran"],
        correct: "Segitiga"
    },
    {
        question: "Bangun ruang yang memiliki satu sisi alas dan satu titik puncak adalah...",
        answers: ["Kubus", "Balok", "Prisma", "Limas"],
        correct: "Limas"
    },
    {
        question: "Balok memiliki jumlah sisi yang sama dengan Kubus, yaitu...",
        answers: ["6", "8", "10", "12"],
        correct: "6"
    }
];

let currentQuestionIndex = 0;
let score = 0;

const questionText = document.getElementById("question-text");
const answerButtons = document.getElementById("answer-buttons");
const btnNext = document.getElementById("btnNext");
const quizResult = document.getElementById("quiz-result");

function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    btnNext.classList.add("hidden");
    quizResult.textContent = "";
    showQuestion(quizData[currentQuestionIndex]);
}

function showQuestion(q) {
    questionText.textContent = `${currentQuestionIndex + 1}. ${q.question}`;
    answerButtons.innerHTML = '';
    btnNext.classList.add("hidden");

    q.answers.forEach(answer => {
        const button = document.createElement("button");
        button.textContent = answer;
        button.classList.add("answer-btn");
        button.addEventListener("click", () => selectAnswer(button, q.correct));
        answerButtons.appendChild(button);
    });
}

function selectAnswer(selectedButton, correctAnswer) {
    const isCorrect = selectedButton.textContent === correctAnswer;
    
    Array.from(answerButtons.children).forEach(button => {
        button.disabled = true; 
        if (button.textContent === correctAnswer) {
            button.classList.add("correct");
        } else {
            button.classList.add("incorrect");
        }
    });

    if (isCorrect) {
        score++;
    } 

    btnNext.classList.remove("hidden");
    btnNext.textContent = currentQuestionIndex < quizData.length - 1 ? "Lanjut ➡️" : "Lihat Hasil 🎉";
}

btnNext.addEventListener("click", () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < quizData.length) {
        showQuestion(quizData[currentQuestionIndex]);
    } else {
        showResult();
    }
});

function showResult() {
    questionText.textContent = "Kuis Selesai!";
    answerButtons.innerHTML = "";
    btnNext.classList.add("hidden");
    
    let resultMessage = `Skor Anda: ${score} dari ${quizData.length} pertanyaan. `;
    if (score === quizData.length) {
        resultMessage += "Hebat! Pemahaman Anda tentang ciri bangun ruang sangat baik! ⭐";
        quizResult.style.color = 'green';
    } else if (score >= quizData.length / 2) {
        resultMessage += "Bagus! Terus eksplorasi di bagian Materi untuk meningkatkan pemahaman Anda.";
        quizResult.style.color = 'orange';
    } else {
        resultMessage += "Terus semangat! Ulangi bagian Materi dan coba lagi.";
        quizResult.style.color = 'red';
    }
    
    quizResult.textContent = resultMessage;
    
    const btnRestart = document.createElement('button');
    btnRestart.textContent = "Ulangi Kuis 🔄";
    btnRestart.classList.add('btn');
    btnRestart.style.marginTop = '15px';
    btnRestart.style.background = '#00bcd4';
    btnRestart.style.color = 'white';
    btnRestart.style.float = 'right';
    btnRestart.addEventListener('click', startQuiz);
    answerButtons.appendChild(btnRestart);
}

document.addEventListener('DOMContentLoaded', () => {
    // Memastikan tampilan awal diatur
    showSection("materi");
});
(() => {
  const startButton = document.getElementById('startButton');
  const restartButton = document.getElementById('restartButton');
  const restartMiniButton = document.getElementById('restartMiniButton');
  const leftButton = document.getElementById('leftButton');
  const rightButton = document.getElementById('rightButton');
  const boostButton = document.getElementById('boostButton');
  const titleScreen = document.getElementById('titleScreen');
  const gameScreen = document.getElementById('gameScreen');
  const gameOverPanel = document.getElementById('gameOverPanel');
  const resultText = document.getElementById('resultText');
  const canvasWrap = document.getElementById('canvasWrap');
  const scoreElement = document.getElementById('score');
  const distanceElement = document.getElementById('distance');
  const livesElement = document.getElementById('lives');
  const floatingMessage = document.getElementById('floatingMessage');

  let scene;
  let camera;
  let renderer;
  let clock;
  let playerGroup;
  let aiKartGroup;
  let animationId = 0;
  let initialized = false;
  let gameRunning = false;

  const roadSegments = [];
  const laneMarkers = [];
  const roadside = [];
  const entities = [];
  const laneX = [-2.7, 0, 2.7];
  const keyState = { left: false, right: false };

  let playerTargetX = 0;
  let score = 0;
  let distance = 0;
  let lives = 3;
  let spawnTimer = 0;
  let gameTime = 0;
  let hitCooldown = 0;
  let messageTimer = 0;
  let aiDistance = 0;
  let aiSpeed = 10.8;
  let aiLane = 2.7;
  let aiTargetLane = 2.7;
  let aiBoostTimer = 0;
  let boostTimer = 0;
  let countdownToken = 0;
  let nextBoostSpawn = 2.5;

  startButton.addEventListener('click', startGameScreen);
  restartButton.addEventListener('click', resetRace);
  restartMiniButton.addEventListener('click', resetRace);
  boostButton.addEventListener('click', triggerBoost);

  bindHold(leftButton, () => keyState.left = true, () => keyState.left = false);
  bindHold(rightButton, () => keyState.right = true, () => keyState.right = false);

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') {
      keyState.left = true;
      event.preventDefault();
    }
    if (key === 'arrowright' || key === 'd') {
      keyState.right = true;
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') keyState.left = false;
    if (key === 'arrowright' || key === 'd') keyState.right = false;
  });

  function startGameScreen() {
    titleScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    if (typeof THREE === 'undefined') {
      canvasWrap.innerHTML = '<div style="height:100%;display:grid;place-items:center;text-align:center;padding:24px;font-weight:800;color:#7a2a00">three.js を読み込めませんでした。インターネット接続を確認して再読み込みしてね。</div>';
      return;
    }

    if (!initialized) {
      initThree();
      initialized = true;
    }

    resetRace();
  }

  function initThree() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd9f5ff, 28, 95);

    camera = new THREE.PerspectiveCamera(
      47,
      canvasWrap.clientWidth / canvasWrap.clientHeight,
      0.1,
      160
    );

    // 低い追従視点。カートとみかん君が画面下中央に見える高さ。
    camera.position.set(0, 2.6, 10.6);
    camera.lookAt(0, 0.3, -10);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvasWrap.clientWidth, canvasWrap.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    canvasWrap.prepend(renderer.domElement);

    clock = new THREE.Clock();

    addLights();
    createTrack();
    createRoadside();
    createPlayer();
    createAIKart();

    window.addEventListener('resize', onResize);
    animate();
  }

  function addLights() {
    scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa66, 1.6));

    const sun = new THREE.DirectionalLight(0xffffff, 1.25);
    sun.position.set(8, 13, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    scene.add(sun);
  }

  function createTrack() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x545960, roughness: 0.96 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x78bf51, roughness: 1 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });

    for (let i = 0; i < 5; i += 1) {
      const z = -i * 30;
      const segment = new THREE.Group();

      const grass = new THREE.Mesh(new THREE.PlaneGeometry(34, 30), grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.y = -1.4;
      grass.receiveShadow = true;
      segment.add(grass);

      const road = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 30), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.y = -1.34;
      road.receiveShadow = true;
      segment.add(road);

      const edgeL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 30), whiteMat);
      edgeL.position.set(-5.2, -1.29, 0);
      const edgeR = edgeL.clone();
      edgeR.position.x = 5.2;
      segment.add(edgeL, edgeR);

      segment.position.z = z;
      scene.add(segment);
      roadSegments.push(segment);

      for (let j = 0; j < 6; j += 1) {
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 2.6), whiteMat);
        marker.position.set(0, -1.27, z + 12 - j * 5);
        scene.add(marker);
        laneMarkers.push(marker);
      }
    }
  }

  function createRoadside() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3fa947, roughness: 1 });

    for (let i = 0; i < 26; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const tree = new THREE.Group();

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.35, 9), trunkMat);
      trunk.position.y = -0.7;
      trunk.castShadow = true;

      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 14), leafMat);
      crown.position.y = 0.2;
      crown.castShadow = true;

      tree.add(trunk, crown);
      tree.position.set(side * 8.4, 0, -i * 7.2);
      scene.add(tree);
      roadside.push(tree);
    }
  }

  function createPlayer() {
    playerGroup = new THREE.Group();

    const redMat = new THREE.MeshStandardMaterial({ color: 0xf14b3c, roughness: 0.82 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x343a40, roughness: 0.85 });
    const grayMat = new THREE.MeshStandardMaterial({ color: 0xa6abb0, roughness: 0.86 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.95 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.38, 3.5), redMat);
    base.position.y = -0.74;
    base.castShadow = true;
    base.receiveShadow = true;
    playerGroup.add(base);

    const leftSide = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 2.6), redMat);
    leftSide.position.set(-1.08, -0.43, 0);
    const rightSide = leftSide.clone();
    rightSide.position.x = 1.08;
    playerGroup.add(leftSide, rightSide);

    const seatBottom = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.2, 1.0), darkMat);
    seatBottom.position.set(0, -0.33, -0.2);
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.78, 0.18), darkMat);
    seatBack.position.set(0, 0.02, -0.65);
    playerGroup.add(seatBottom, seatBack);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.24, 0.9), grayMat);
    bumper.position.set(0, -0.58, 1.95);
    playerGroup.add(bumper);

    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.34, 18);
    [
      [-1.38, -0.95, 1.05],
      [1.38, -0.95, 1.05],
      [-1.38, -0.95, -1.2],
      [1.38, -0.95, -1.2]
    ].forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      wheel.castShadow = true;
      playerGroup.add(wheel);
    });

    const steeringStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 10), darkMat);
    steeringStem.position.set(0, 0.03, 0.8);
    steeringStem.rotation.x = 0.42;
    playerGroup.add(steeringStem);

    const steering = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 10, 18), darkMat);
    steering.rotation.x = Math.PI / 2.2;
    steering.position.set(0, 0.35, 1.0);
    playerGroup.add(steering);

    const character = createMikanCharacter();
    character.position.set(0, -0.32, -0.08);
    character.rotation.y = Math.PI;
    character.scale.setScalar(0.68);
    playerGroup.add(character);

    playerGroup.position.set(0, 0, 5.0);
    scene.add(playerGroup);
  }


  function createAIKart() {
    aiKartGroup = new THREE.Group();

    const blueMat = new THREE.MeshStandardMaterial({ color: 0x3f6ff2, roughness: 0.78 });
    const blueDarkMat = new THREE.MeshStandardMaterial({ color: 0x2549a8, roughness: 0.82 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.9 });
    const grayMat = new THREE.MeshStandardMaterial({ color: 0xb8bec5, roughness: 0.82 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.98 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffcf4a, roughness: 0.76 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xfff3d8, roughness: 0.82 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.38, 3.35), blueMat);
    base.position.y = -0.74;
    base.castShadow = true;
    base.receiveShadow = true;
    aiKartGroup.add(base);

    const leftSide = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.52, 2.55), blueDarkMat);
    leftSide.position.set(-1.06, -0.42, 0);
    const rightSide = leftSide.clone();
    rightSide.position.x = 1.06;
    aiKartGroup.add(leftSide, rightSide);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.27, 0.8), grayMat);
    nose.position.set(0, -0.58, 1.83);
    aiKartGroup.add(nose);

    const seatBottom = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.95), darkMat);
    seatBottom.position.set(0, -0.33, -0.15);
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.18), darkMat);
    seatBack.position.set(0, 0.04, -0.62);
    aiKartGroup.add(seatBottom, seatBack);

    const steeringStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 10), darkMat);
    steeringStem.position.set(0, 0.02, 0.73);
    steeringStem.rotation.x = 0.42;
    const steering = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.045, 10, 18), darkMat);
    steering.rotation.x = Math.PI / 2.2;
    steering.position.set(0, 0.30, 0.91);
    aiKartGroup.add(steeringStem, steering);

    const wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.33, 18);
    [
      [-1.34, -0.95, 1.0],
      [1.34, -0.95, 1.0],
      [-1.34, -0.95, -1.12],
      [1.34, -0.95, -1.12]
    ].forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      wheel.castShadow = true;
      aiKartGroup.add(wheel);
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.78, 0.68), creamMat);
    body.position.set(0, 0.10, -0.02);
    body.castShadow = true;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.68, 24, 24), yellowMat);
    head.position.set(0, 0.92, 0.02);
    head.castShadow = true;

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x161616 });
    const eyeGeo = new THREE.SphereGeometry(0.055, 10, 10);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.18, 0.99, 0.655);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.18;

    const handGeo = new THREE.SphereGeometry(0.10, 12, 12);
    const leftHand = new THREE.Mesh(handGeo, creamMat);
    leftHand.position.set(-0.16, 0.34, 0.70);
    const rightHand = leftHand.clone();
    rightHand.position.x = 0.16;

    aiKartGroup.add(body, head, leftEye, rightEye, leftHand, rightHand);

    aiKartGroup.scale.setScalar(0.82);
    aiKartGroup.position.set(2.7, 0, 5.0);
    scene.add(aiKartGroup);
  }


  function createMikanCharacter() {
    const group = new THREE.Group();

    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff8c20, roughness: 0.74 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x36ad47, roughness: 0.9 });
    const limeMat = new THREE.MeshStandardMaterial({ color: 0xb7eb65, roughness: 0.88 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xe94437, roughness: 0.85 });

    // 2頭身寄り。体はかなり低く、頭を大きめに。
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.96, 32, 32), orangeMat);
    head.position.set(0, 1.35, 0.12);
    head.castShadow = true;
    group.add(head);

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({ map: makeFaceTexture(), transparent: true })
    );
    face.position.set(0, 1.35, 0.95);
    group.add(face);

    const leaf1 = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.42, 5), greenMat);
    leaf1.position.set(-0.13, 2.27, 0.06);
    leaf1.rotation.z = -0.35;
    const leaf2 = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.42, 5), greenMat);
    leaf2.position.set(0.13, 2.24, 0.07);
    leaf2.rotation.z = 0.55;
    group.add(leaf1, leaf2);

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 0.82), limeMat);
    body.position.set(0, 0.28, 0);
    body.castShadow = true;
    group.add(body);

    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 0.7),
      new THREE.MeshBasicMaterial({ map: makeMTexture(), transparent: true })
    );
    m.position.set(0, 0.28, 0.42);
    group.add(m);

    const cape = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.02, 0.07), redMat);
    cape.position.set(0, 0.3, -0.45);
    cape.castShadow = true;
    group.add(cape);

    const armGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.62, 10);
    const leftArm = new THREE.Mesh(armGeo, whiteMat);
    leftArm.position.set(-0.35, 0.48, 0.35);
    leftArm.rotation.z = 1.1;
    leftArm.rotation.x = 0.3;
    const rightArm = new THREE.Mesh(armGeo, whiteMat);
    rightArm.position.set(0.35, 0.48, 0.35);
    rightArm.rotation.z = -1.1;
    rightArm.rotation.x = 0.3;
    group.add(leftArm, rightArm);

    const handGeo = new THREE.SphereGeometry(0.13, 14, 14);
    const leftHand = new THREE.Mesh(handGeo, whiteMat);
    leftHand.position.set(-0.13, 0.58, 0.62);
    const rightHand = new THREE.Mesh(handGeo, whiteMat);
    rightHand.position.set(0.13, 0.58, 0.62);
    group.add(leftHand, rightHand);

    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10);
    const leftLeg = new THREE.Mesh(legGeo, whiteMat);
    leftLeg.position.set(-0.18, -0.30, 0.03);
    const rightLeg = new THREE.Mesh(legGeo, whiteMat);
    rightLeg.position.set(0.18, -0.30, 0.03);
    group.add(leftLeg, rightLeg);

    const footGeo = new THREE.SphereGeometry(0.12, 14, 14);
    const leftFoot = new THREE.Mesh(footGeo, whiteMat);
    leftFoot.position.set(-0.18, -0.5, 0.16);
    leftFoot.scale.set(1.0, 0.75, 1.4);
    const rightFoot = new THREE.Mesh(footGeo, whiteMat);
    rightFoot.position.set(0.18, -0.5, 0.16);
    rightFoot.scale.set(1.0, 0.75, 1.4);
    group.add(leftFoot, rightFoot);

    return group;
  }

  function makeFaceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);

    ctx.fillStyle = '#161616';
    ctx.beginPath();
    ctx.arc(180, 180, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(330, 180, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 18;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(248, 245);
    ctx.lineTo(316, 256);
    ctx.lineTo(252, 404);
    ctx.lineTo(208, 278);
    ctx.closePath();
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function makeMTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 44;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(90, 395);
    ctx.lineTo(90, 125);
    ctx.lineTo(188, 260);
    ctx.lineTo(256, 178);
    ctx.lineTo(324, 260);
    ctx.lineTo(422, 125);
    ctx.lineTo(422, 395);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function resetRace() {
    score = 0;
    distance = 0;
    lives = 3;
    spawnTimer = 0;
    gameTime = 0;
    hitCooldown = 0;
    playerTargetX = 0;
    aiDistance = 0;
    aiSpeed = 10.6 + Math.random() * 0.4;
    aiLane = 2.7;
    aiTargetLane = 2.7;
    aiBoostTimer = 0;
    boostTimer = 0;
    nextBoostSpawn = 4.0;
    keyState.left = false;
    keyState.right = false;

    if (playerGroup) {
      playerGroup.position.set(0, 0, 5.0);
      playerGroup.rotation.set(0, 0, 0);
    }

    while (entities.length) {
      const item = entities.pop();
      scene.remove(item.mesh);
    }

    // スタート直後から見えるブースト床を3枚置く。
    spawnBoostPadAt(-18, -2.7);
    spawnBoostPadAt(-34, 0);
    spawnBoostPadAt(-50, 2.7);

    gameOverPanel.classList.add('hidden');
    updateHud();
    gameRunning = false;
    if (clock) clock.getDelta();
    startCountdown();
  }

  function startCountdown() {
    const token = ++countdownToken;
    const steps = ['3', '2', '1', 'GO!'];
    let index = 0;

    const showNext = () => {
      if (token !== countdownToken) return;
      popMessage(steps[index], 850, true);

      if (steps[index] === 'GO!') {
        gameRunning = true;
        return;
      }

      index += 1;
      setTimeout(showNext, 900);
    };

    showNext();
  }

  function updateRace(delta) {
    const speed = boostTimer > 0 ? 19 : 13;
    gameTime += delta;
    if (boostTimer > 0) boostTimer -= delta;
    distance += speed * delta;
    spawnTimer += delta;
    if (hitCooldown > 0) hitCooldown -= delta;

    moveTrack(speed * delta);
    moveRoadside(speed * delta);
    movePlayer(delta);
    moveAIKart(delta, speed);
    moveEntities(speed, delta);

    if (spawnTimer > 1.15) {
      spawnTimer = 0;
      if (Math.random() < 0.62) spawnObstacle();
      else spawnItem();
    }

    nextBoostSpawn -= delta;
    if (nextBoostSpawn <= 0) {
      spawnBoostPad();
      nextBoostSpawn = 3.2;
    }

    updateHud();
  }

  function movePlayer(delta) {
    const moveSpeed = 7.2;
    if (keyState.left) playerTargetX -= moveSpeed * delta;
    if (keyState.right) playerTargetX += moveSpeed * delta;
    playerTargetX = clamp(playerTargetX, -3.2, 3.2);

    playerGroup.position.x += (playerTargetX - playerGroup.position.x) * Math.min(1, 10 * delta);
    playerGroup.rotation.z = (playerTargetX - playerGroup.position.x) * 0.13;
    const steeringYaw = clamp((playerTargetX - playerGroup.position.x) * -0.06, -0.10, 0.10);
    playerGroup.rotation.y = -roadHeading(distance) + steeringYaw;
    playerGroup.position.y = Math.sin(gameTime * 11) * 0.025;

    // カメラも少しだけ左右に追従。高さは変えない。
    camera.position.x += (playerGroup.position.x * 0.18 - camera.position.x) * Math.min(1, 4 * delta);
    camera.lookAt(playerGroup.position.x * 0.12, 0.25, -10);
  }


  function moveAIKart(delta, playerSpeed) {
    if (!aiKartGroup) return;

    if (aiBoostTimer > 0) aiBoostTimer -= delta;

    // AIが画面外へ飛び出さないよう、プレイヤーとの差で速度を調整。
    const relativeBefore = aiDistance - distance;
    let targetSpeed = 10.9;
    if (relativeBefore > 24) targetSpeed = 9.2;
    else if (relativeBefore > 16) targetSpeed = 10.0;
    else if (relativeBefore < -2) targetSpeed = 12.0;
    else if (relativeBefore < 4) targetSpeed = 11.4;
    if (aiBoostTimer > 0) targetSpeed += 4.2;

    aiSpeed += (targetSpeed - aiSpeed) * Math.min(1, 1.7 * delta);
    aiDistance += aiSpeed * delta;

    // 万一差が広がりすぎても、見える範囲から消えない。
    const maxAhead = 30;
    const maxBehind = -5;
    if (aiDistance - distance > maxAhead) aiDistance = distance + maxAhead;
    if (aiDistance - distance < maxBehind) aiDistance = distance + maxBehind;

    chooseAILane();

    // レーン変更は瞬間移動せず、ハンドルを切って滑らかに移動。
    aiLane += (aiTargetLane - aiLane) * Math.min(1, 2.8 * delta);

    const relative = aiDistance - distance;
    aiKartGroup.position.z = 5.0 - relative;

    const aiRoadX = roadCenter(aiDistance) - roadCenter(distance);
    aiKartGroup.position.x = aiRoadX + aiLane;
    aiKartGroup.position.y = Math.sin(gameTime * 6.5 + 1.4) * 0.012;

    const steerAmount = aiTargetLane - aiLane;
    aiKartGroup.rotation.z = clamp(-steerAmount * 0.07, -0.12, 0.12);

    aiKartGroup.rotation.y = -roadHeading(aiDistance)
      + clamp(-steerAmount * 0.045, -0.10, 0.10);

    aiKartGroup.visible = true;
  }

  function chooseAILane() {
    const lanes = [-2.7, 0, 2.7];
    const aiZ = aiKartGroup.position.z;

    const dangerInLane = (lane) => entities.some((entity) => {
      if (entity.type !== 'obstacle') return false;
      const dz = aiZ - entity.mesh.position.z;
      return dz > 0 && dz < 16 && Math.abs(entity.laneOffset - lane) < 1.1;
    });

    // まず、近くにあるブースト床を探す。
    let boostChoice = null;
    let nearestBoost = Infinity;
    entities.forEach((entity) => {
      if (entity.type !== 'boost') return;
      const dz = aiZ - entity.mesh.position.z;
      if (dz > 0 && dz < 24 && dz < nearestBoost && !dangerInLane(entity.laneOffset)) {
        nearestBoost = dz;
        boostChoice = nearestLane(entity.laneOffset);
      }
    });

    if (boostChoice !== null) {
      aiTargetLane = boostChoice;
      return;
    }

    // 今いるレーンの前に障害物があれば、安全な隣のレーンへ。
    if (dangerInLane(aiTargetLane)) {
      const safe = lanes
        .filter((lane) => !dangerInLane(lane))
        .sort((a, b) => Math.abs(a - aiLane) - Math.abs(b - aiLane));
      if (safe.length) aiTargetLane = safe[0];
    }
  }

  function nearestLane(value) {
    return laneX.reduce((best, lane) =>
      Math.abs(lane - value) < Math.abs(best - value) ? lane : best
    , laneX[0]);
  }

  function roadCenter(worldDistance) {
    return Math.sin(worldDistance / 62) * 3.2
      + Math.sin(worldDistance / 140) * 1.4;
  }

  function roadHeading(worldDistance) {
    const sample = 1.5;
    const dx = roadCenter(worldDistance + sample) - roadCenter(worldDistance - sample);
    return Math.atan2(dx, sample * 2);
  }

  function roadOffsetForZ(z) {
    const ahead = playerGroup.position.z - z;
    return roadCenter(distance + ahead) - roadCenter(distance);
  }

  function moveTrack(step) {
    roadSegments.forEach((segment) => {
      segment.position.z += step;
      if (segment.position.z > 30) segment.position.z -= 150;

      const ahead = playerGroup.position.z - segment.position.z;
      const worldPos = distance + ahead;
      const center = roadCenter(worldPos) - roadCenter(distance);
      const heading = roadHeading(worldPos) - roadHeading(distance);

      segment.position.x = center;
      segment.rotation.y = -heading;
    });

    laneMarkers.forEach((marker) => {
      marker.position.z += step;
      if (marker.position.z > 9) marker.position.z -= 30;

      const ahead = playerGroup.position.z - marker.position.z;
      const worldPos = distance + ahead;
      const center = roadCenter(worldPos) - roadCenter(distance);
      const heading = roadHeading(worldPos) - roadHeading(distance);

      marker.position.x = center;
      marker.rotation.y = -heading;
    });
  }

  function moveRoadside(step) {
    roadside.forEach((tree, index) => {
      tree.position.z += step;
      if (tree.position.z > 12) tree.position.z -= 187;

      const ahead = playerGroup.position.z - tree.position.z;
      const worldPos = distance + ahead;
      const center = roadCenter(worldPos) - roadCenter(distance);
      const heading = roadHeading(worldPos) - roadHeading(distance);
      const side = index % 2 === 0 ? -1 : 1;

      const lateralX = Math.cos(heading) * side * 8.4;
      const lateralZ = Math.sin(heading) * side * 8.4;
      tree.position.x = center + lateralX;
      tree.position.z += lateralZ * 0.03;
    });
  }

  function spawnObstacle() {
    const mesh = createObstacle();
    mesh.position.set(roadOffsetForZ(-62) + randomLane(), -0.5, -62);
    scene.add(mesh);
    entities.push({ type: 'obstacle', mesh, laneOffset: mesh.position.x - roadOffsetForZ(mesh.position.z) });
  }

  function spawnItem() {
    const mesh = createMikanItem();
    mesh.position.set(roadOffsetForZ(-62) + randomLane(), -0.05, -62);
    scene.add(mesh);
    entities.push({ type: 'item', mesh, spin: 0, laneOffset: mesh.position.x - roadOffsetForZ(mesh.position.z) });
  }

  function triggerBoost() {
    if (!gameRunning) return;
    boostTimer = Math.max(boostTimer, 1.35);
    popMessage('BOOST!', 650, false);
  }

  function spawnBoostPad() {
    spawnBoostPadAt(-62, randomLane());
  }

  function spawnBoostPadAt(z, x) {
    const mesh = createBoostPad();
    mesh.position.set(roadOffsetForZ(z) + x, -1.20, z);
    scene.add(mesh);
    entities.push({ type: 'boost', mesh, laneOffset: mesh.position.x - roadOffsetForZ(mesh.position.z) });
  }

  function createBoostPad() {
    const group = new THREE.Group();
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x2ad7ff,
      emissive: 0x075a75,
      emissiveIntensity: 0.8,
      roughness: 0.45
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x77ddff,
      emissiveIntensity: 0.35,
      roughness: 0.35
    });

    const pad = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.10, 3.4), glowMat);
    const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 2.65), stripeMat);
    const stripe2 = stripe1.clone();
    stripe1.position.set(-0.48, 0.06, 0);
    stripe2.position.set(0.48, 0.06, 0);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const arrowGeo = new THREE.ConeGeometry(0.28, 0.75, 3);
    const arrow1 = new THREE.Mesh(arrowGeo, arrowMat);
    arrow1.rotation.x = Math.PI / 2;
    arrow1.position.set(0, 0.09, 0.55);
    const arrow2 = arrow1.clone();
    arrow2.position.z = -0.45;
    group.add(pad, stripe1, stripe2, arrow1, arrow2);
    return group;
  }

  function createObstacle() {
    const group = new THREE.Group();
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x4e63f0, roughness: 0.85 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.25, 1.35), blueMat);
    box.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.22, 1.42), whiteMat);
    stripe.position.y = 0.1;
    group.add(box, stripe);
    return group;
  }

  function createMikanItem() {
    const group = new THREE.Group();
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff941c, roughness: 0.72 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x35a849, roughness: 0.9 });
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.48, 20, 20), orangeMat);
    fruit.castShadow = true;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 5), greenMat);
    leaf.position.y = 0.6;
    leaf.rotation.z = 0.6;
    group.add(fruit, leaf);
    return group;
  }

  function moveEntities(speed, delta) {
    for (let i = entities.length - 1; i >= 0; i -= 1) {
      const entity = entities[i];
      entity.mesh.position.z += speed * delta;
      if (entity.laneOffset === undefined) {
        entity.laneOffset = entity.mesh.position.x - roadOffsetForZ(entity.mesh.position.z);
      }
      entity.mesh.position.x = roadOffsetForZ(entity.mesh.position.z) + entity.laneOffset;

      if (entity.type === 'item') {
        entity.spin += delta * 4.5;
        entity.mesh.rotation.y = entity.spin;
        entity.mesh.position.y = -0.05 + Math.sin(entity.spin * 2) * 0.12;
      }

      if (aiKartGroup) {
        const aiDx = Math.abs(entity.mesh.position.x - aiKartGroup.position.x);
        const aiDz = Math.abs(entity.mesh.position.z - aiKartGroup.position.z);

        if (entity.type === 'boost' && aiDx < 1.35 && aiDz < 1.75) {
          aiBoostTimer = Math.max(aiBoostTimer, 1.6);
          scene.remove(entity.mesh);
          entities.splice(i, 1);
          continue;
        }

        // 避けきれなかった時だけ実際に衝突して減速。
        if (entity.type === 'obstacle' && aiDx < 1.05 && aiDz < 1.15) {
          aiSpeed = 6.8;
          aiDistance = Math.max(distance - 4, aiDistance - 1.8);
          scene.remove(entity.mesh);
          entities.splice(i, 1);
          popMessage('AI HIT!', 500, false);
          continue;
        }
      }

      if (isCollision(entity.mesh.position.x, entity.mesh.position.z, entity.type)) {
        if (entity.type === 'item') {
          score += 10;
          popMessage('+10 みかん！');
        } else if (entity.type === 'boost') {
          boostTimer = Math.max(boostTimer, 1.8);
          popMessage('BOOST!', 650, false);
        } else if (hitCooldown <= 0) {
          lives -= 1;
          hitCooldown = 0.7;
          popMessage('いたっ！');
          if (lives <= 0) endGame();
        }

        scene.remove(entity.mesh);
        entities.splice(i, 1);
        continue;
      }

      if (entity.mesh.position.z > 12) {
        scene.remove(entity.mesh);
        entities.splice(i, 1);
      }
    }
  }

  function isCollision(x, z, type) {
    const dx = Math.abs(x - playerGroup.position.x);
    const dz = Math.abs(z - playerGroup.position.z);
    const xLimit = type === 'item' ? 1.15 : type === 'boost' ? 1.45 : 1.25;
    const zLimit = type === 'item' ? 1.0 : type === 'boost' ? 1.8 : 1.25;
    return dx < xLimit && dz < zLimit;
  }

  function endGame() {
    gameRunning = false;
    resultText.textContent = `スコア ${score} / きょり ${Math.floor(distance)}m`;
    gameOverPanel.classList.remove('hidden');
  }

  function updateHud() {
    scoreElement.textContent = score;
    distanceElement.textContent = `${Math.floor(distance)}m`;
    livesElement.textContent = lives;
  }

  function popMessage(text, duration = 750, large = false) {
    floatingMessage.textContent = text;
    floatingMessage.classList.toggle('countdown', large);
    floatingMessage.classList.add('show');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
      floatingMessage.classList.remove('show');
      floatingMessage.classList.remove('countdown');
    }, duration);
  }

  function randomLane() {
    return laneX[Math.floor(Math.random() * laneX.length)];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function bindHold(button, onStart, onEnd) {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      onStart();
    });
    button.addEventListener('pointerup', onEnd);
    button.addEventListener('pointerleave', onEnd);
    button.addEventListener('pointercancel', onEnd);
  }

  function onResize() {
    if (!renderer || !camera) return;
    const width = canvasWrap.clientWidth;
    const height = canvasWrap.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.033);
    if (gameRunning) updateRace(delta);
    renderer.render(scene, camera);
  }

  window.addEventListener('beforeunload', () => {
    if (animationId) cancelAnimationFrame(animationId);
  });
})();

(() => {
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const restartMiniButton = document.getElementById("restartMiniButton");
  const leftButton = document.getElementById("leftButton");
  const rightButton = document.getElementById("rightButton");
  const titleScreen = document.getElementById("titleScreen");
  const gameScreen = document.getElementById("gameScreen");
  const gameOverPanel = document.getElementById("gameOverPanel");
  const resultText = document.getElementById("resultText");
  const canvasWrap = document.getElementById("canvasWrap");
  const scoreElement = document.getElementById("score");
  const distanceElement = document.getElementById("distance");
  const livesElement = document.getElementById("lives");
  const floatingMessage = document.getElementById("floatingMessage");

  let scene, camera, renderer, clock;
  let roadSegments = [];
  let laneMarkers = [];
  let roadside = [];
  let playerGroup = null;
  let playerTargetX = 0;
  let animationId = 0;
  let isStarted = false;
  let gameRunning = false;
  let score = 0;
  let distance = 0;
  let lives = 3;
  let spawnTimer = 0;
  let gameTime = 0;
  let showMessageTimer = 0;
  let obstacleCooldown = 0;

  const laneX = [-2.8, 0, 2.8];
  const entities = [];
  const keyState = { left: false, right: false };

  startButton.addEventListener("click", startGameScreen);
  restartButton.addEventListener("click", resetAndStartRace);
  restartMiniButton.addEventListener("click", resetAndStartRace);

  setupHoldButton(leftButton, () => {
    keyState.left = true;
  }, () => {
    keyState.left = false;
  });

  setupHoldButton(rightButton, () => {
    keyState.right = true;
  }, () => {
    keyState.right = false;
  });

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  function startGameScreen() {
    titleScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");

    if (typeof THREE === "undefined") {
      canvasWrap.innerHTML = '<div style="height:100%;display:grid;place-items:center;padding:24px;text-align:center;font-weight:700;color:#7a2a00">three.js の読み込みに失敗しました。インターネット接続を確認して、ページを再読み込みしてね。</div>';
      return;
    }

    if (!isStarted) {
      initThree();
      isStarted = true;
    }

    resetAndStartRace();
  }

  function initThree() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd9f5ff, 20, 80);

    camera = new THREE.PerspectiveCamera(45, canvasWrap.clientWidth / canvasWrap.clientHeight, 0.1, 140);
    camera.position.set(0, 5.7, 12.5);
    camera.lookAt(0, 2.2, -12);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvasWrap.clientWidth, canvasWrap.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    canvasWrap.prepend(renderer.domElement);

    clock = new THREE.Clock();

    addLights();
    createTrack();
    createDecorations();
    createPlayer();

    window.addEventListener("resize", onResize);
    animate();
  }

  function addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(9, 16, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    scene.add(sun);
  }

  function createTrack() {
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x4d515b, roughness: 0.95 });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x78bf51, roughness: 1 });

    for (let i = 0; i < 4; i += 1) {
      const segment = new THREE.Group();
      const zOffset = -i * 30;

      const grass = new THREE.Mesh(new THREE.PlaneGeometry(34, 30), grassMaterial);
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(0, -1.35, zOffset);
      grass.receiveShadow = true;
      segment.add(grass);

      const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 30), roadMaterial);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, -1.3, zOffset);
      road.receiveShadow = true;
      segment.add(road);

      const leftEdge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 30), edgeMaterial);
      leftEdge.position.set(-5, -1.27, zOffset);
      leftEdge.receiveShadow = true;
      segment.add(leftEdge);

      const rightEdge = leftEdge.clone();
      rightEdge.position.x = 5;
      segment.add(rightEdge);

      scene.add(segment);
      roadSegments.push(segment);

      for (let j = 0; j < 6; j += 1) {
        const marker = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.02, 2.7),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
        );
        marker.position.set(0, -1.24, zOffset + 12 - j * 5);
        marker.receiveShadow = true;
        scene.add(marker);
        laneMarkers.push(marker);
      }
    }
  }

  function createDecorations() {
    for (let i = 0; i < 20; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 1.4, 10),
        new THREE.MeshStandardMaterial({ color: 0x8f5d2a, roughness: 1 })
      );
      trunk.position.y = -0.65;
      trunk.castShadow = true;
      const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x3cad41, roughness: 1 })
      );
      leaves.position.y = 0.3;
      leaves.castShadow = true;
      tree.add(trunk, leaves);
      tree.position.set(side * 8.8, -0.55, -i * 8);
      scene.add(tree);
      roadside.push(tree);
    }
  }

  function createPlayer() {
    playerGroup = new THREE.Group();

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.9 });
    const kartRed = new THREE.MeshStandardMaterial({ color: 0xf14939, roughness: 0.8 });
    const kartGray = new THREE.MeshStandardMaterial({ color: 0x9499a3, roughness: 0.85 });
    const kartDark = new THREE.MeshStandardMaterial({ color: 0x444b54, roughness: 0.85 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.45, 3.6), kartRed);
    base.position.y = -0.8;
    base.castShadow = true;
    base.receiveShadow = true;
    playerGroup.add(base);

    const sideLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 2.7), kartRed);
    sideLeft.position.set(-1.15, -0.45, 0.15);
    sideLeft.castShadow = true;
    const sideRight = sideLeft.clone();
    sideRight.position.x = 1.15;
    playerGroup.add(sideLeft, sideRight);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 1.25), kartGray);
    nose.position.set(0, -0.58, 2.0);
    nose.castShadow = true;
    playerGroup.add(nose);

    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.22, 1.2), kartDark);
    seatBase.position.set(0, -0.38, -0.15);
    seatBase.castShadow = true;
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 0.22), kartDark);
    seatBack.position.set(0, 0.05, -0.65);
    seatBack.castShadow = true;
    playerGroup.add(seatBase, seatBack);

    const steeringPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 12), kartDark);
    steeringPole.position.set(0, 0.0, 0.95);
    steeringPole.rotation.x = 0.45;
    steeringPole.castShadow = true;
    playerGroup.add(steeringPole);

    const steering = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.05, 12, 18),
      new THREE.MeshStandardMaterial({ color: 0x2e333a, roughness: 0.8 })
    );
    steering.rotation.x = Math.PI / 2.2;
    steering.position.set(0, 0.35, 1.15);
    playerGroup.add(steering);

    const rearBar = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.18), kartGray);
    rearBar.position.set(0, -0.78, -1.7);
    rearBar.castShadow = true;
    playerGroup.add(rearBar);

    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 20);
    const wheelPositions = [
      [-1.5, -0.96, 1.1],
      [1.5, -0.96, 1.1],
      [-1.5, -0.96, -1.2],
      [1.5, -0.96, -1.2]
    ];
    wheelPositions.forEach((pos) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos[0], pos[1], pos[2]);
      wheel.castShadow = true;
      playerGroup.add(wheel);
    });

    const character = createMikanCharacter();
    character.scale.set(0.74, 0.74, 0.74);
    character.position.set(0, -0.58, -0.05);
    playerGroup.add(character);

    playerGroup.position.set(0, 0, 5.5);
    scene.add(playerGroup);
  }

  function createMikanCharacter() {
    const group = new THREE.Group();
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff8c20, roughness: 0.72 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x38b44a, roughness: 0.85 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb7eb65, roughness: 0.85 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xeb4335, roughness: 0.82 });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.92, 32, 32), orangeMat);
    head.position.set(0, 1.55, 0.12);
    head.castShadow = true;
    group.add(head);

    const facePlate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.34, 1.34),
      new THREE.MeshBasicMaterial({ map: createFaceTexture(), transparent: true })
    );
    facePlate.position.set(0, 1.54, 0.91);
    group.add(facePlate);

    const leaf1 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 5), greenMat);
    leaf1.position.set(-0.11, 2.48, 0.06);
    leaf1.rotation.z = -0.3;
    leaf1.castShadow = true;
    const leaf2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 5), greenMat);
    leaf2.position.set(0.11, 2.46, 0.08);
    leaf2.rotation.z = 0.55;
    leaf2.castShadow = true;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0x82501e, roughness: 1 }));
    stem.position.set(0, 2.27, 0.03);
    stem.castShadow = true;
    group.add(leaf1, leaf2, stem);

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1.15, 0.82), bodyMat);
    body.position.set(0, 0.35, 0);
    body.castShadow = true;
    group.add(body);

    const mPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.76),
      new THREE.MeshBasicMaterial({ map: createMTexture(), transparent: true })
    );
    mPlate.position.set(0, 0.34, 0.42);
    group.add(mPlate);

    const cape = new THREE.Mesh(new THREE.BoxGeometry(1.48, 1.28, 0.07), redMat);
    cape.position.set(0, 0.38, -0.45);
    cape.castShadow = true;
    group.add(cape);

    const armGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.7, 12);
    const leftArm = new THREE.Mesh(armGeo, whiteMat);
    leftArm.position.set(-0.42, 0.55, 0.34);
    leftArm.rotation.z = 1.12;
    leftArm.rotation.x = 0.32;
    leftArm.castShadow = true;
    const rightArm = new THREE.Mesh(armGeo, whiteMat);
    rightArm.position.set(0.42, 0.55, 0.34);
    rightArm.rotation.z = -1.12;
    rightArm.rotation.x = 0.32;
    rightArm.castShadow = true;
    group.add(leftArm, rightArm);

    const handGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const leftHand = new THREE.Mesh(handGeo, whiteMat);
    leftHand.position.set(-0.16, 0.66, 0.62);
    leftHand.castShadow = true;
    const rightHand = new THREE.Mesh(handGeo, whiteMat);
    rightHand.position.set(0.16, 0.66, 0.62);
    rightHand.castShadow = true;
    group.add(leftHand, rightHand);

    const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.34, 10);
    const leftLeg = new THREE.Mesh(legGeo, whiteMat);
    leftLeg.position.set(-0.2, -0.36, 0.0);
    leftLeg.castShadow = true;
    const rightLeg = new THREE.Mesh(legGeo, whiteMat);
    rightLeg.position.set(0.2, -0.36, 0.0);
    rightLeg.castShadow = true;
    group.add(leftLeg, rightLeg);

    const footGeo = new THREE.SphereGeometry(0.13, 16, 16);
    const leftFoot = new THREE.Mesh(footGeo, whiteMat);
    leftFoot.position.set(-0.2, -0.58, 0.18);
    leftFoot.scale.set(1.1, 0.8, 1.5);
    leftFoot.castShadow = true;
    const rightFoot = new THREE.Mesh(footGeo, whiteMat);
    rightFoot.position.set(0.2, -0.58, 0.18);
    rightFoot.scale.set(1.1, 0.8, 1.5);
    rightFoot.castShadow = true;
    group.add(leftFoot, rightFoot);

    return group;
  }

  function createFaceTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 512, 512);

    ctx.fillStyle = "#151515";
    ctx.beginPath();
    ctx.arc(180, 190, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(322, 190, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 20;
    ctx.strokeStyle = "#151515";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(250, 250);
    ctx.lineTo(316, 266);
    ctx.lineTo(250, 404);
    ctx.lineTo(208, 278);
    ctx.closePath();
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
  }

  function createMTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 512, 512);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 42;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(92, 392);
    ctx.lineTo(92, 124);
    ctx.lineTo(190, 254);
    ctx.lineTo(256, 172);
    ctx.lineTo(322, 254);
    ctx.lineTo(420, 124);
    ctx.lineTo(420, 392);
    ctx.stroke();
    return new THREE.CanvasTexture(canvas);
  }

  function resetAndStartRace() {
    score = 0;
    distance = 0;
    lives = 3;
    spawnTimer = 0;
    gameTime = 0;
    obstacleCooldown = 0;
    playerTargetX = 0;
    updateHud();
    popMessage("GO!");
    gameOverPanel.classList.add("hidden");

    keyState.left = false;
    keyState.right = false;

    if (playerGroup) {
      playerGroup.position.x = 0;
      playerGroup.position.z = 5.5;
      playerGroup.rotation.z = 0;
    }

    while (entities.length) {
      const entity = entities.pop();
      scene.remove(entity.mesh);
    }

    gameRunning = true;
    clock.getDelta();
  }

  function updateHud() {
    scoreElement.textContent = score;
    distanceElement.textContent = `${Math.floor(distance)}m`;
    livesElement.textContent = lives;
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.033);

    if (gameRunning) {
      updateRace(delta);
    }

    renderer.render(scene, camera);
  }

  function updateRace(delta) {
    gameTime += delta;
    const speed = 18;
    distance += speed * delta;
    spawnTimer += delta;
    if (obstacleCooldown > 0) obstacleCooldown -= delta;

    moveTrack(speed * delta);
    moveRoadside(speed * delta);
    movePlayer(delta);
    updateEntities(speed, delta);

    if (spawnTimer > 0.85) {
      spawnTimer = 0;
      if (Math.random() < 0.64) {
        spawnObstacle();
      } else {
        spawnItem();
      }
    }

    updateHud();
  }

  function moveTrack(step) {
    roadSegments.forEach((segment) => {
      segment.position.z += step;
      if (segment.position.z > 30) {
        segment.position.z -= 120;
      }
    });

    laneMarkers.forEach((marker) => {
      marker.position.z += step;
      if (marker.position.z > 8) {
        marker.position.z -= 30;
      }
    });
  }

  function moveRoadside(step) {
    roadside.forEach((tree) => {
      tree.position.z += step;
      if (tree.position.z > 10) {
        tree.position.z -= 160;
      }
    });
  }

  function movePlayer(delta) {
    if (keyState.left) playerTargetX -= 6 * delta;
    if (keyState.right) playerTargetX += 6 * delta;
    playerTargetX = clamp(playerTargetX, -2.8, 2.8);

    playerGroup.position.x += (playerTargetX - playerGroup.position.x) * 8 * delta;
    playerGroup.rotation.z = (playerTargetX - playerGroup.position.x) * -0.12;
    playerGroup.position.y = Math.sin(gameTime * 10) * 0.04;
  }

  function spawnObstacle() {
    const lane = laneX[Math.floor(Math.random() * laneX.length)];
    const mesh = createObstacleMesh();
    mesh.position.set(lane, -0.35, -60);
    scene.add(mesh);
    entities.push({ type: "obstacle", mesh, hit: false });
  }

  function spawnItem() {
    const lane = laneX[Math.floor(Math.random() * laneX.length)];
    const mesh = createItemMesh();
    mesh.position.set(lane, 0.2, -60);
    scene.add(mesh);
    entities.push({ type: "item", mesh, hit: false, spin: Math.random() * Math.PI * 2 });
  }

  function createObstacleMesh() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 1.35, 1.35),
      new THREE.MeshStandardMaterial({ color: 0x5260ee, roughness: 0.8 })
    );
    body.castShadow = true;
    const whiteStripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.22, 1.42),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })
    );
    whiteStripe.position.y = 0.1;
    group.add(body, whiteStripe);
    return group;
  }

  function createItemMesh() {
    const group = new THREE.Group();
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 22, 22),
      new THREE.MeshStandardMaterial({ color: 0xff961f, roughness: 0.72 })
    );
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.3, 5),
      new THREE.MeshStandardMaterial({ color: 0x41b64c, roughness: 0.9 })
    );
    leaf.position.set(0, 0.68, 0);
    leaf.rotation.z = 0.6;
    group.add(fruit, leaf);
    return group;
  }

  function updateEntities(speed, delta) {
    for (let i = entities.length - 1; i >= 0; i -= 1) {
      const entity = entities[i];
      entity.mesh.position.z += speed * delta;

      if (entity.type === "item") {
        entity.spin += delta * 4;
        entity.mesh.rotation.y = entity.spin;
        entity.mesh.position.y = 0.3 + Math.sin(entity.spin * 2) * 0.12;
      }

      if (!entity.hit && isColliding(entity.mesh.position.x, entity.mesh.position.z, entity.type === "item" ? 0.95 : 1.15)) {
        entity.hit = true;
        if (entity.type === "item") {
          score += 10;
          popMessage("+10 みかん！");
        } else if (obstacleCooldown <= 0) {
          lives -= 1;
          obstacleCooldown = 0.6;
          popMessage("いたっ！");
          if (lives <= 0) {
            endGame();
          }
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

  function isColliding(x, z, size) {
    const dx = Math.abs(x - playerGroup.position.x);
    const dz = Math.abs(z - playerGroup.position.z);
    return dx < 1.0 && dz < size;
  }

  function endGame() {
    gameRunning = false;
    resultText.textContent = `スコア ${score} / きょり ${Math.floor(distance)}m`;
    gameOverPanel.classList.remove("hidden");
    popMessage("ゴール！");
  }

  function popMessage(message) {
    floatingMessage.textContent = message;
    floatingMessage.classList.add("show");
    clearTimeout(showMessageTimer);
    showMessageTimer = setTimeout(() => {
      floatingMessage.classList.remove("show");
    }, 780);
  }

  function onResize() {
    if (!renderer || !camera) return;
    const width = canvasWrap.clientWidth;
    const height = canvasWrap.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (["arrowleft", "a"].includes(key)) {
      keyState.left = true;
      event.preventDefault();
    }
    if (["arrowright", "d"].includes(key)) {
      keyState.right = true;
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    const key = event.key.toLowerCase();
    if (["arrowleft", "a"].includes(key)) keyState.left = false;
    if (["arrowright", "d"].includes(key)) keyState.right = false;
  }

  function setupHoldButton(button, onStart, onEnd) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      onStart();
    });
    button.addEventListener("pointerup", onEnd);
    button.addEventListener("pointerleave", onEnd);
    button.addEventListener("pointercancel", onEnd);
    button.addEventListener("touchend", onEnd, { passive: true });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  window.addEventListener("beforeunload", () => {
    if (animationId) cancelAnimationFrame(animationId);
  });
})();
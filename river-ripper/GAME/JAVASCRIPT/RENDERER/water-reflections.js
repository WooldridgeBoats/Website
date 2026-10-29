// Water and material lighting for the bundled Three.js r150 renderer.
// Oblique clipping follows Three.js Reflector's camera-space plane approach:
// https://github.com/mrdoob/three.js/blob/r150/examples/jsm/objects/Reflector.js
(function () {
    var R = RR.Renderer3D;
    var buildScene = R.buildScene, render = R.render, dispose = R.dispose;

    R._prepareReflections = function () {
        var enabled = !RR.Config.LITE && !/[?&]reflections=0\b/.test(location.search);
        if (enabled && !this._reflectionTarget) {
            this._reflectionTarget = new THREE.WebGLRenderTarget(RR.Config.MOBILE ? 320 : 640, RR.Config.MOBILE ? 180 : 360, {
                minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
                type: THREE.HalfFloatType, depthBuffer: true
            });
            this._reflectionCamera = new THREE.PerspectiveCamera();
            this._reflectionDirection = new THREE.Vector3();
            this._reflectionPlane = new THREE.Plane();
            this._reflectionClip = new THREE.Vector4();
            this._reflectionQ = new THREE.Vector4();
        }
        if (this.waterUniforms) {
            this.waterUniforms.uReflection.value = enabled ? this._reflectionTarget.texture : null;
            this.waterUniforms.uReflectionStrength.value = enabled ? 1 : 0;
        }
        // A small prefiltered sky capture supplies real specular lighting to
        // metal and glass, without an external HDR download or per-frame cost.
        var envScene = new THREE.Scene();
        var sky = this.skyDome.clone();
        sky.position.set(0, 0, 0);
        envScene.add(sky);
        var pmrem = new THREE.PMREMGenerator(this.renderer);
        var previous = this._hullEnvironment;
        this._hullEnvironment = pmrem.fromScene(envScene, 0.04, 1, 4000);
        pmrem.dispose();
        var env = this._hullEnvironment.texture;
        this._applyHullEnvironment = function () {
            this.boatGroup.traverse(function (o) {
                if (!o.isMesh || !o.material) return;
                (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
                    if (!m.isMeshStandardMaterial) return;
                    var needsCompile = !m.envMap;
                    m.envMap = env;
                    m.envMapIntensity = m.transparent ? 1.1 : 0.65;
                    if (needsCompile) m.needsUpdate = true;
                });
            });
        };
        this._applyHullEnvironment();
        if (previous) previous.dispose();
    };

    var applyBoat = R._applyBoatModel;
    R._applyBoatModel = function () {
        applyBoat.call(this);
        // CAD arrives asynchronously after the initial scene build.
        if (this._applyHullEnvironment) this._applyHullEnvironment();
    };
    R.buildScene = function () {
        buildScene.call(this);
        this._prepareReflections();
    };

    R._renderWaterReflection = function () {
        if (!this.waterUniforms || !this.waterUniforms.uReflectionStrength.value) return;
        var r = this.renderer, camera = this.camera, mirror = this._reflectionCamera;
        camera.updateMatrixWorld();
        // Reflect the camera and its up vector across the water at y=-0.1.
        mirror.position.copy(camera.position);
        mirror.position.y = -0.2 - camera.position.y;
        camera.getWorldDirection(this._reflectionDirection);
        var direction = this._reflectionDirection;
        direction.y *= -1;
        mirror.up.copy(camera.up); mirror.up.y *= -1;
        mirror.lookAt(direction.add(mirror.position));
        mirror.near = camera.near; mirror.far = camera.far;
        mirror.updateMatrixWorld();
        mirror.projectionMatrix.copy(camera.projectionMatrix);
        var matrix = this.waterUniforms.uReflectionMatrix.value;
        matrix.set(0.5,0,0,0.5, 0,0.5,0,0.5, 0,0,0.5,0.5, 0,0,0,1);
        matrix.multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);

        // Clip everything below the surface so submerged terrain cannot
        // occlude the reflected bank when viewed from the mirrored camera.
        var plane = this._reflectionPlane;
        plane.normal.set(0, 1, 0); plane.constant = 0.1;
        plane.applyMatrix4(mirror.matrixWorldInverse);
        var clip = this._reflectionClip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
        var p = mirror.projectionMatrix.elements, q = this._reflectionQ;
        q.set((Math.sign(clip.x)+p[8])/p[0], (Math.sign(clip.y)+p[9])/p[5], -1, (1+p[10])/p[14]);
        clip.multiplyScalar(2 / clip.dot(q));
        p[2] = clip.x; p[6] = clip.y; p[10] = clip.z + 0.999; p[14] = clip.w;
        mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();

        var hidden = [];
        var waterMaterial = this.waterMesh.material;
        this.scene.traverse(function (o) {
            if (o.visible && (o.material === waterMaterial || o === R.wakeGroup || o === R.boatGroup)) {
                hidden.push(o); o.visible = false;
            }
        });
        var target = r.getRenderTarget(), shadows = r.shadowMap.autoUpdate;
        var tone = r.toneMapping, encoding = r.outputEncoding;
        try {
            // Keep reflection data linear; the water applies tone mapping once.
            r.shadowMap.autoUpdate = false;
            r.toneMapping = THREE.NoToneMapping;
            r.outputEncoding = THREE.LinearEncoding;
            r.setRenderTarget(this._reflectionTarget);
            r.clear();
            r.render(this.scene, mirror);
        } finally {
            hidden.forEach(function (o) { o.visible = true; });
            r.setRenderTarget(target);
            r.shadowMap.autoUpdate = shadows;
            r.toneMapping = tone; r.outputEncoding = encoding;
        }
    };
    R.render = function () {
        if (this.ready) this._renderWaterReflection();
        render.call(this);
    };
    R.dispose = function () {
        if (this._reflectionTarget) this._reflectionTarget.dispose();
        if (this._hullEnvironment) this._hullEnvironment.dispose();
        this._reflectionTarget = null;
        this._hullEnvironment = null;
        this._applyHullEnvironment = null;
        dispose.call(this);
    };
})();

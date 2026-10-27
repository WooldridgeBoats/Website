// Photo foliage with opaque geometry retained as a browser-safe interior.
(function () {
    var R = RR.Renderer3D, createTrees = R._createTreeInstances;
    function shrinkCore(chunk) {
        if (chunk._photoCore || !chunk.blobs) return;
        chunk._photoCore = true;
        var m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3();
        for (var i = 0; i < chunk.blobs.count; i++) {
            chunk.blobs.getMatrixAt(i, m); m.decompose(pos, q, scale);
            scale.multiplyScalar(0.48); m.compose(pos, q, scale); chunk.blobs.setMatrixAt(i, m);
        }
        chunk.blobs.instanceMatrix.needsUpdate = true;
    }
    R._createTreeInstances = function () {
        createTrees.call(this);
        if (RR.Config.LITE || /[?&]foliage=0\b/.test(location.search)) return;
        var positions = [], uv = [];
        for (var side = 0; side < 3; side++) {
            var angle = side * Math.PI / 3, x = Math.cos(angle) * 1.35, z = Math.sin(angle) * 1.35;
            [-1,1,1,-1,1,-1].forEach(function (sign, i) {
                var y = [-1,-1,1,-1,1,1][i];
                positions.push(x*sign, y*1.28, z*sign);
                uv.push((sign+1)*0.5, (y+1)*0.5);
            });
        }
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.computeVertexNormals(); geo._rrShared = true;
        this._treeShared.geos.push(geo);
        var mats = [], self = this;
        if (!this._photoCanopies) this._photoCanopies = [];
        for (var i = 0; i < 4; i++) {
            var tex = this._photoCanopies[i];
            if (!tex) {
                var cv = document.createElement('canvas'); cv.width=256; cv.height=256;
                tex = new THREE.CanvasTexture(cv);
                tex.encoding = THREE.sRGBEncoding;
                tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
                tex._rrShared = true;
                this._photoCanopies[i] = tex;
                (function (texture, canvas, index) {
                    var img = new Image();
                    img.onload = function () {
                        // Decode into a plain RGBA canvas, removing source color
                        // profiles before upload (same path as the boat decals).
                        canvas.getContext('2d').drawImage(img,0,0,256,256);
                        texture.needsUpdate = true;
                        texture._photoReady = true;
                        self.treeChunks.forEach(function (chunk, ci) { if (ci % 4 === index) shrinkCore(chunk); });
                    };
                    img.src = 'GAME/ASSETS/VEG/CANOPY-' + (index+1) + '.png';
                })(tex, cv, i);
            }
            var mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xCBD1C3,
                side: THREE.DoubleSide, alphaTest: 0.32, depthWrite: true });
            mat._rrShared = true; mats.push(mat); this._treeShared.mats.push(mat);
        }
        this.treeChunks.forEach(function (chunk, index) {
            if (!chunk.blobs) return;
            var leaves = new THREE.InstancedMesh(geo, mats[index % 4], chunk.blobs.count);
            leaves.instanceMatrix.copy(chunk.blobs.instanceMatrix);
            leaves.frustumCulled = false;
            leaves.userData.photoFoliage = true;
            chunk.group.add(leaves);
            if (mats[index % 4].map._photoReady) shrinkCore(chunk);
        });
    };
    // Alpha cards do not participate in the coarse shadow map: their opaque
    // cores already cast a stable canopy shadow with no extra shadow draw.
    var shadowFlags = R._applyShadowFlags;
    R._applyShadowFlags = function () {
        shadowFlags.call(this);
        this.scene.traverse(function(o) {
            if (o.userData.photoFoliage) { o.castShadow = false; o.receiveShadow = false; }
        });
    };
    // Keep every cloud edge transparent. The original radial gradients were
    // cropped by a 256x64 rectangle, leaving hard horizontal strips in the sky.
    R._makeCloudTexture = function () {
        var cv=document.createElement('canvas'); cv.width=512; cv.height=256;
        var ctx=cv.getContext('2d');
        for (var i=0;i<18;i++) {
            var x=96+i*19, y=135-Math.sin(i*0.57)*30, radius=32+18*(0.5+0.5*Math.sin(i*2.31));
            var g=ctx.createRadialGradient(x,y,2,x,y,radius);
            g.addColorStop(0,'rgba(248,250,252,0.65)');
            g.addColorStop(0.5,'rgba(230,238,246,0.45)');
            g.addColorStop(1,'rgba(218,230,242,0)');
            ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
        }
        return new THREE.CanvasTexture(cv);
    };
})();

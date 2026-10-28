window.RR = window.RR || {};

// Three optional stunt ramps per river. All coordinates use simulation units;
// the mesh and launch trigger share the same dimensions and placement data.
RR.Ramps = {
    items: [], halfWidth: 20, length: 52, height: 6,
    generate: function () {
        this.items = [];
        var river = RR.River, C = RR.Config, fractions = [0.22, 0.49, 0.76];
        for (var n = 0; n < fractions.length; n++) {
            var seed = Math.floor(river.finishSegment * fractions[n]);
            // Require a broad, gently turning reach and an island-free landing.
            for (var offset = 0; offset < 1000; offset++) {
                var index = seed + (offset % 2 ? -Math.ceil(offset / 2) : offset / 2);
                if (index < river.launchClearSegments + 20 || this.items.some(function(r){return Math.abs(r.z/C.SEGMENT_LENGTH-index)<170;})) continue;
                if (index + 65 >= river.finishSegment) continue;
                var safe = !river.logJams.some(function(jam){return jam.end >= index-35 && jam.start <= index+6;});
                if (!safe) continue;
                for (var k = index - 28; k <= index + 45; k++) {
                    var seg = river.segments[k];
                    if (!seg || seg.island || seg.width < 0.65 || Math.abs(seg.curve) > 1.8 || seg.marker) {safe=false;break;}
                }
                if (!safe) continue;
                var x = n === 1 ? -0.22 : 0.22;
                this.items.push({z:index*C.SEGMENT_LENGTH,x:x,used:false});
                // Protect the approach and landing corridor, keeping hazards
                // outside it and the rest of the river unchanged.
                for (k=index-28;k<=index+45;k++) {
                    river.segments[k].obstacles= k <= index+6 ? [] : river.segments[k].obstacles.filter(function(o){return Math.abs(o.x-x)>0.5;});
                }
                // Open water after every ramp: no forced obstacle or penalty for a miss.
                break;
            }
        }
    },
    reset: function () { this.items.forEach(function(r){r.used=false;}); },
    update: function (boat) {
        var C=RR.Config, before=boat.previousZ === undefined ? boat.z : boat.previousZ;
        var length=this.length/C.WORLD_SCALE, oldHeight=boat.rampHeight || 0;
        boat.rampHeight=0; boat.rampPitch=0;
        if (boat.crashed || boat.grounded) {boat._ridingRamp=null;return;}
        for(var i=0;i<this.items.length;i++) {
            var ramp=this.items[i], end=ramp.z+length;
            if(ramp.used || boat.z<ramp.z || before>end) continue;
            var seg=RR.River.getSegmentAtZ(ramp.z), half=seg.width*C.BASE_RIVER_HALF_WIDTH*C.WORLD_SCALE;
            // Any hull overlap counts. Entering partway up the deck works too.
            var centered=Math.abs(boat.lateral-ramp.x)*half < this.halfWidth+3*boat.getModel().beamScale;
            if(!centered || boat.jumpHeight>0) continue;
            boat._ridingRamp=ramp;
            var progress=Math.max(0,Math.min(1,(boat.z-ramp.z)/length));
            boat.rampHeight=progress*this.height;
            boat.rampPitch=-Math.atan2(this.height,this.length);
            if(boat.z>=end) {
                ramp.used=true;boat._ridingRamp=null;
                boat.rampHeight=0;boat.rampPitch=0;
                boat.jumpHeight=this.height/C.WORLD_SCALE;
                boat.jumpVelocity=1050;boat.jumpBuffered=0;
                boat.jumpCooldown=C.JUMP_COOLDOWN;boat.jumpCount++;
                boat.boostTimer=C.RAMP_BOOST_SECONDS;
                boat.speed=Math.max(boat.speed,boat.getMaxSpeed()*0.94);
                RR.Audio.play('splash',0.65);
            }
            return;
        }
        // Sliding off an edge settles into the water; never drops instantly
        // through the deck or charges a hull strike for imperfect alignment.
        if(boat._ridingRamp && oldHeight>0 && boat.jumpHeight<=0) {
            boat.jumpHeight=oldHeight/C.WORLD_SCALE;boat.jumpVelocity=0;
        }
        boat._ridingRamp=null;
    },
    animate: function (time) {
        if (this.arrowMaterial) this.arrowMaterial.opacity = 0.72 + 0.28 * Math.sin(time * Math.PI * 3);
    },
    buildMeshes: function (renderer) {
        if(renderer.rampGroup) {renderer._disposeGroup(renderer.rampGroup);renderer.scene.remove(renderer.rampGroup);}
        var group=new THREE.Group(), self=this;
        var canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
        var ctx=canvas.getContext('2d');ctx.fillStyle='#273640';ctx.fillRect(0,0,256,512);
        ctx.fillStyle='#e9ab38';ctx.fillRect(0,0,18,512);ctx.fillRect(238,0,18,512);
        var texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
        var mat=new THREE.MeshStandardMaterial({map:texture,roughness:0.72,metalness:0.25,side:THREE.DoubleSide});
        var arrows=document.createElement('canvas');arrows.width=256;arrows.height=512;
        var ac=arrows.getContext('2d');ac.strokeStyle='#fff37a';ac.fillStyle='#fff37a';ac.lineWidth=17;
        for(var y=65;y<310;y+=85){ac.beginPath();ac.moveTo(48,y+36);ac.lineTo(128,y);ac.lineTo(208,y+36);ac.stroke();}
        ac.font='bold 53px sans-serif';ac.textAlign='center';ac.fillText('BOOST',128,405);
        var arrowTexture=new THREE.CanvasTexture(arrows);arrowTexture.encoding=THREE.sRGBEncoding;
        var arrowMat=new THREE.MeshBasicMaterial({map:arrowTexture,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,toneMapped:false});
        this.arrowMaterial=arrowMat;
        this.items.forEach(function(ramp){
            var wp=renderer.getWorldPos(ramp.z,ramp.x), root=new THREE.Group();
            root.position.set(wp.x,0.12,wp.z);root.rotation.y=wp.heading;
            var geo=new THREE.BufferGeometry(), w=self.halfWidth,l=self.length,h=self.height;
            geo.setAttribute('position',new THREE.Float32BufferAttribute([-w,0,0,w,0,0,-w,h,l,w,0,0,w,h,l,-w,h,l],3));
            geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,0,1,1,0,1],2));
            geo.computeVertexNormals();var deck=new THREE.Mesh(geo,mat);deck.castShadow=true;deck.receiveShadow=true;root.add(deck);
            var markings=new THREE.Mesh(geo,arrowMat);markings.position.y=0.03;root.add(markings);
            var supportMat=new THREE.MeshStandardMaterial({color:0x303a40,roughness:0.7,metalness:0.5});
            [-w+1.5,w-1.5].forEach(function(x){var support=new THREE.Mesh(new THREE.BoxGeometry(1.6,h,2),supportMat);support.position.set(x,h/2,l-1);root.add(support);});
            group.add(root);
        });
        // With no viable ramp there is no mesh to own these resources.
        if(!this.items.length){texture.dispose();mat.dispose();arrowTexture.dispose();arrowMat.dispose();this.arrowMaterial=null;}
        renderer.rampGroup=group;renderer.scene.add(group);
    }
};

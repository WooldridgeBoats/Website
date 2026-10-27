(function(){
    var R=RR.Renderer3D,build=R.buildScene;
    R.buildScene=function(){
        build.call(this);
        if(!this._terrainTextures){
            var loader=new THREE.TextureLoader(),self=this;
            this._terrainTextures={};
            ['gravel','ground'].forEach(function(key){
                var t=loader.load('GAME/ASSETS/TERRAIN/skyquolmie-'+key+'.jpg');
                t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;
                t.anisotropy=Math.min(8,self.renderer.capabilities.getMaxAnisotropy());t._rrShared=true;
                self._terrainTextures[key]=t;
            });
        }
        var textures=this._terrainTextures;
        function map(mesh,texture,scale){
            if(!mesh)return;
            var old=mesh.material.map;
            if(old && !old._rrShared)old.dispose();
            var pos=mesh.geometry.attributes.position,uv=new Float32Array(pos.count*2);
            for(var i=0;i<pos.count;i++){uv[i*2]=pos.getX(i)/scale;uv[i*2+1]=pos.getZ(i)/scale;}
            mesh.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
            mesh.material.map=texture;mesh.material.color.setHex(0xDDD9CF);mesh.material.needsUpdate=true;
        }
        var id=RR.River.profile.id;
        if(id==='skyqualmie'||id==='rogue'){
            map(this.bankLeftMesh,textures.gravel,12);map(this.bankRightMesh,textures.gravel,12);
            map(this.groundLeftMesh,textures.ground,22);map(this.groundRightMesh,textures.ground,22);
        }
        if(this._islandMat){
            this._islandMat.onBeforeCompile=function(shader){
                shader.uniforms.rrGravel={value:textures.gravel};shader.uniforms.rrGround={value:textures.ground};
                shader.vertexShader='varying vec3 rrTerrainPos;\n'+shader.vertexShader;
                shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrrTerrainPos=position;');
                shader.fragmentShader='varying vec3 rrTerrainPos;\nuniform sampler2D rrGravel;\nuniform sampler2D rrGround;\n'+shader.fragmentShader;
                shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat green=smoothstep(1.03,1.3,vColor.g/max(vColor.r,0.001));\nvec3 detail=mix(texture2D(rrGravel,rrTerrainPos.xz/12.0).rgb,texture2D(rrGround,rrTerrainPos.xz/22.0).rgb,green);\ndiffuseColor.rgb *= pow(detail,vec3(2.2))*3.0;');
            };
            this._islandMat.needsUpdate=true;
        }
    };
})();

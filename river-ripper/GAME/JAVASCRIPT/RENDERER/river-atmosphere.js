// Art direction inferred from real-river reference imagery. These are visual
// profiles, not claims that each arcade course is a surveyed reconstruction.
(function () {
    var R=RR.Renderer3D, apply=R._applyRiverProfile;
    var profiles={
        skyqualmie:{chop:1.0,sediment:0.12,fog:0.00125,sun:1.55,cloud:0.72},
        rogue:{chop:1.15,sediment:0.08,fog:0.00135,sun:1.55,cloud:0.55},
        colorado:{chop:1.4,sediment:0.42,fog:0.00105,sun:1.85,cloud:0.22},
        amazon:{chop:0.72,sediment:0.9,fog:0.00165,sun:1.10,cloud:0.95},
        zambezi:{chop:1.85,sediment:0.2,fog:0.00125,sun:1.8,cloud:0.40},
        mekong:{chop:0.90,sediment:0.8,fog:0.0015,sun:1.35,cloud:0.80},
        rhine:{chop:0.85,sediment:0.28,fog:0.00145,sun:1.30,cloud:0.78},
        nile:{chop:0.65,sediment:0.06,fog:0.0011,sun:1.85,cloud:0.12}
    };
    R._applyRiverProfile=function(){
        apply.call(this);
        var p=RR.River.profile, a=profiles[p.id]||profiles.skyqualmie;
        this.scene.fog.density=a.fog;
        this.sunLight.intensity=a.sun;
        if(this.waterUniforms){
            this.waterUniforms.uChop.value=a.chop;
            this.waterUniforms.uSediment.value=a.sediment;
            this.waterUniforms.uFogDensity.value=a.fog;
            // Seasonal, silt-bearing Mekong reference; keep the Amazon warmer.
            if(p.id==='mekong'){
                this.waterUniforms.uDeepColor.value.setHex(0x67513B);
                this.waterUniforms.uMidColor.value.setHex(0x8B7251);
                this.waterUniforms.uShallowColor.value.setHex(0xAE926D);
            }
            if(p.id==='amazon'){
                this.waterUniforms.uDeepColor.value.setHex(0x715335);
                this.waterUniforms.uMidColor.value.setHex(0x93764F);
            }
        }
        if(this._cloudPlanes)this._cloudPlanes.forEach(function(o){o.material.opacity=a.cloud;});
        // Lowland Amazon floodplain and Egyptian desert should not inherit
        // Washington's jagged mountain silhouettes.
        if(this._backdrop && (p.id==='amazon'||p.id==='nile')) this._backdrop.forEach(function(b){b.mesh.visible=false;});
    };
})();

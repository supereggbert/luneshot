import { 
    MeshBasicMaterial,
    Mesh,
    DoubleSide,
    TextureLoader,
    RepeatWrapping,
    AdditiveBlending,
    GLTFLoader,
    Vector3
} from './three.js';

import Emitter from './emitter.js';

import noise from '../res/textures/noise.png';
import domeglb from '../res/models/dome.glb';


const texture = new TextureLoader().load( noise );
texture.wrapS = RepeatWrapping;
texture.wrapT = RepeatWrapping;

export default class Shields{
    constructor(scene,loaded){
        this.damage = 0.05;
        this.shields = [];
        this.scene = scene;
        var loader = new GLTFLoader().setPath( './' );
        loader.load( domeglb, ( gltf ) => {
            var geometry;
            gltf.scene.traverse( ( child ) => {
                if ( child.type=="Mesh" ) {
                    geometry=child.geometry;
                }
            } );
            this.geometry = geometry;
            this.addShield(34.72,0,4);
            this.addShield(-134.6,0,-111);
            this.addShield(-143.7,0,109.9);
            loaded();
        });
    }
    reset(){
        this.shields.forEach(el=>el.strengh=1);
    }
    update(dt){
        for(let i=0;i<this.shields.length;i++){
            this.shields[i].power -= Math.min(this.shields[i].power, this.shields[i].power*10*dt/1000 );
            this.shields[i].material.opacity = this.shields[i].power;
            this.shields[i].emitter.setStrengh(this.shields[i].strengh);
        }
    }
    doCollition(position){
        for(let i=0;i<this.shields.length;i++){
            if(this.shields[i].strengh==0) continue;
            if(position.distanceTo(this.shields[i].position)<150){
                this.shields[i].power=1;
                this.shields[i].strengh=Math.max(0,this.shields[i].strengh-this.damage);
                return {position:position.clone(),distance: 0};
            }
        }
    }
    isNear(position){
        for(var i=0;i<this.shields.length;i++){
            var shield = this.shields[i];
            var dx=shield.position.x-position.x;
            var dy=80-position.y;
            var dz=shield.position.z-position.z;
            var d = Math.sqrt(dx*dx+dy*dy+dz*dz);
            if(d<50){
                return shield;
            }
        }
        return false;
    }
    addShield(x,y,z){
        var materialShader;
        var material = new MeshBasicMaterial( {color: 0xffffff, blending: AdditiveBlending, map:texture, depthTest: true, depthWrite: false, opacity: 0.5, transparent: true,side: DoubleSide} );
        material.onBeforeCompile=(shader)=>{
            shader.fragmentShader = shader.fragmentShader.replace("#include <common>",`
            #include <common>
            uniform float uTime;
            `)
            shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`
                float texelColor1 = texture2D( map, vUv*10.0+vec2(0.0,uTime)*0.5 ).r;
                float texelColor2 = texture2D( map, vUv*7.0-vec2(uTime,0.0)*0.2 ).r;
                float texelColor = (texelColor1-0.5)+(texelColor2-0.5);
                float td1 = 1.0-clamp(abs(texelColor)*50.0,0.0,1.0);
                float td2 = 1.0-clamp(abs(texelColor)*20.0,0.0,1.0);
                diffuseColor.rgb = vec3(td1)+td2*vec3(0.0,0.5,1.0)+vec3(0.0,0.1,0.2);
                diffuseColor.a*=max(0.0,0.8-length(vUv*2.0-vec2(1.0)));
            `)
            shader.uniforms['uTime']={value:0};
            materialShader = shader;
        }
        var sphere = new Mesh( this.geometry, material );
        sphere.onBeforeRender=()=>{
            if(materialShader) materialShader.uniforms['uTime'].value=performance.now()/1000;
        }
        sphere.position.set(x,y,z);
        sphere.scale.set(150,150,150);

        var emitter=new Emitter(new Vector3(x,100,z), this.scene);

        this.shields.push({position:sphere.position,material:material,power:0, strengh:1,emitter:emitter});
        this.scene.add( sphere );
    }
}